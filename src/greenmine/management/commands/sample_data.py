# -*- coding: utf-8 -*-

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.utils import IntegrityError
from django.core import management  
from django.contrib.webdesign import lorem_ipsum
from django.utils.timezone import now

import random, sys, datetime

from greenmine.models import *

subjects = [
    "Fixing templates for Django 1.2.",
    "get_actions() does not check for 'delete_selected' in actions",
    "Experimental: modular file types",
    "Add setting to allow regular users to create folders at the root level.",
    "add tests for bulk operations",
    "create testsuite with matrix builds",
    "Lighttpd support",
    "Lighttpd x-sendfile support", 
    "Added file copying and processing of images (resizing)",
    "Exception is thrown if trying to add a folder with existing name",
    "Feature/improved image admin",
    "Support for bulk actions",
]

class Command(BaseCommand):
    @transaction.commit_on_success
    def handle(self, *args, **options):
        from django.core import management
        management.call_command('loaddata', 'development_users')
        users_counter = 0

        def create_user(counter):
            user = User.objects.create(
                username = 'foouser%d' % (counter),
                first_name = 'foouser%d' % (counter),
                email = 'foouser%d@foodomain.com' % (counter),
            )
            return user
           
        # projects
        for x in xrange(3):
            # create project
            project = Project.objects.create(
                name = 'Project Example %s' % (x),
                description = 'Project example %s description' % (x),
                owner = random.choice(list(User.objects.all()[:1])),
                public = True,
            )
            
            project.add_user(project.owner, "developer")

            extras = project.get_extras()
            extras.show_burndown = True
            extras.show_sprint_burndown = True
            extras.sprints = 4
            extras.save()
            
            # add random participants to project
            participants = []
            for t in xrange(random.randint(1, 2)):
                participant = create_user(users_counter)
                participants.append(participant)

                project.add_user(participant, "developer")
                users_counter += 1

            now_date = now() - datetime.timedelta(30)
            
            # create random milestones
            for y in xrange(2):
                milestone = Milestone.objects.create(
                    project = project,
                    name = 'Sprint %s' % (y),
                    owner = project.owner,
                    created_date = now_date,
                    modified_date = now_date,
                    estimated_start = now_date,
                    estimated_finish = now_date + datetime.timedelta(15)
                )

                now_date = now_date +  datetime.timedelta(15)
                
                # create uss asociated to milestones
                for z in xrange(5):
                    us = UserStory.objects.create(
                        subject = lorem_ipsum.words(random.randint(4,9), common=False),
                        priority = 6,
                        points = 3,
                        project = project,
                        owner = random.choice(participants),
                        description = lorem_ipsum.words(30, common=False),
                        milestone = milestone,
                        status = 'completed',
                    )
                    
                    for w in xrange(3):
                        task = Task.objects.create(
                            subject = "Task %s" % (w),
                            description = lorem_ipsum.words(30, common=False),
                            project = project,
                            owner = random.choice(participants),
                            milestone = milestone,
                            user_story = us,
                            status = 'completed',
                        )

            # created unassociated uss.

            for y in xrange(10):
                us = UserStory.objects.create(
                    subject = lorem_ipsum.words(random.randint(4,9), common=False),
                    priority = 3,
                    points = 3,
                    status = 'open',
                    owner = random.choice(participants),
                    description = lorem_ipsum.words(30, common=False),
                    milestone = None,
                    project = project,
                )
