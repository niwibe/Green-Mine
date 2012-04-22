# -*- coding: utf-8 -*-

from django.views.decorators.cache import cache_page
from django.utils.translation import ugettext_lazy as _
from django.utils.encoding import force_unicode
from django.http import HttpResponseRedirect, HttpResponse
from django.conf import settings
from django.core.paginator import Paginator, InvalidPage, EmptyPage
from django.core.urlresolvers import reverse
from django.core.mail import EmailMessage
from django.utils import simplejson
from django.shortcuts import render_to_response, get_object_or_404
from django.template.loader import render_to_string
from django.template import RequestContext, loader
from django.contrib import messages
from django.db.utils import IntegrityError
from django.db import transaction
from django.utils.decorators import method_decorator
from django.views.generic import TemplateView, RedirectView, View
from django.db.models import Q

import logging, re
logger = logging.getLogger('greenmine')

from greenmine.models import *
from greenmine import models, forms, utils
from greenmine.views.decorators import login_required
from greenmine.views.generic import GenericView
import datetime

class UserListApiView(GenericView):
    @login_required
    def get(self, request):
        if "term" not in request.GET:
            return self.render_to_ok({'list':[]})
        
        term = request.GET['term']
        users = models.User.objects.filter(
            Q(username__istartswith=term) | Q(first_name__istartswith=term) | Q(last_name__istartswith=term)
        )
        users_list = []

        for user in users:
            users_list_item = {}
            users_list_item['id'] = user.id
            full_name = user.get_full_name()
            if full_name:
                users_list_item['label'] = full_name
                users_list_item['value'] = full_name
            else:
                users_list_item['label'] = user.username
                users_list_item['value'] = user.username

            users_list_item['gravatar'] = '/static/auxiliar/imgs/gravatar.jpg'
            users_list.append(users_list_item)

        context = {'list': users_list}
        return self.render_to_ok(context)


class UserStoryAsociateApiView(GenericView):
    """ Asociate user story with one milestone. """
    @login_required
    def get(self, request, pslug, iref):
        us = get_object_or_404(models.UserStory, ref=iref, project__slug=pslug)
        try:
            mid = int(request.GET.get('milestone', ''))
        except (ValueError, TypeError):
            return self.render_to_error('invalid paremeters')
        
        if mid == 0:
            us.milestone = None
        else:
            us.milestone = get_object_or_404(models.Milestone, \
                project__slug=pslug, pk=mid)

        us.tasks.update(milestone=us.milestone)
        us.save()
        return self.render_to_ok()

        
class I18NLangChangeApiView(GenericView):
    """ View for set language."""
    def get(self, request):
        if 'lang' in request.GET and request.GET['lang'] \
                                    in dict(settings.LANGUAGES).keys():
            request.session['django_language'] = request.GET['lang']
            if request.META.get('HTTP_REFERER', ''):
                return HttpResponseRedirect(request.META['HTTP_REFERER'])
            elif "next" in request.GET and request.GET['next']:
                return HttpResponseRedirect(request.GET['next'])
        
        return HttpResponseRedirect('/')


from django.core.cache import cache
import uuid

class ForgottenPasswordApiView(GenericView):
    """ TODO: send mails asyncronous with celery tasks. """

    def post(self, request):
        form = forms.ForgottenPasswordForm(request.POST)
        if form.is_valid():
            utils.send_recovery_email(form.user)
            messages.info(request, _(u'He has sent an email with the link to retrieve your password'))
            return self.render_to_ok({'redirect_to':'/'})

        response = {'errors': form.errors}
        return self.render_to_error(response)


class TaskAlterApiView(GenericView):
    """ Api view for alter task status, priority and other 
    minor modifications. """

    def post(self, request, pslug, taskref):
        project = get_object_or_404(models.Project, slug=pslug)
        task = get_object_or_404(project.tasks, ref=taskref)
        us = get_object_or_404(project.user_stories, pk=request.POST.get('us',None))

        mf = request.POST.get('modify_flag', '')
        if mf not in ['close', 'progress', 'new']:
            return self.render_to_error()

        # mark old us modified
        if task.user_story and task.user_story != us:
            task.user_story.modified_date = datetime.datetime.now()

        task.user_story = us
        
        if mf == 'close':
            task.status = 'completed'
        elif mf == 'progress':
            task.status = 'progress'
        else:
            task.status = 'open'

        task.save()
        
        # automatic control of user story status.
        if us.tasks.filter(status__in=['closed','completed']).count() == us.tasks.all().count():
            us.status = 'completed'
        elif us.tasks.all().count() == us.tasks.filter(status='open').count():
            us.status = 'open'
        else:
            us.status = 'progress'

        us.save()
        return self.render_to_ok()
 

class TaskReasignationsApiView(GenericView):
    def get(self, request, pslug, taskref):
        project = get_object_or_404(models.Project, slug=pslug)
        task = get_object_or_404(project.tasks, ref=taskref)
        
        userid = request.GET.get('userid', '')
        if not userid:
            task.assigned_to = None
        else:
            task.assigned_to = get_object_or_404(project.participants, pk=userid)

        task.save()
        return self.render_to_ok()


""" Statistics Views """

class MilestoneStatsApiView(GenericView):
    def get(self, request, pslug, mid):
        project = get_object_or_404(models.Project, slug=pslug)
        milestone = get_object_or_404(project.milestones, pk=mid)
        
        total_tasks = milestone.tasks.all().count()
        total_sum = sum([2 if x.status in ['completed', 'closed'] else 1 \
            for x in milestone.tasks.exclude(status='open')])

        value = (total_sum * 100)/(total_tasks*2)
        
        return self.render_to_ok({'ts': total_sum, 't': total_tasks, 'v':value})
