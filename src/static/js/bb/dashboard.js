var UserStory = Backbone.Model.extend({});
var UserStoryCollection = Backbone.Collection.extend({
    model: UserStory
});


var UserStoryView = Backbone.View.extend({
    tagName: 'tr',

    events: {},

    initialize: function() {
        _.bindAll(this, 'render');
        this.model.bind('change', this.render);
        this.model.bind('reset', this.render);
    },

    render: function() {
        this.$el.replaceWith(this.model.get('html'));
        return this;
    }
});


var DashboardView = Backbone.View.extend({
    el: $("#dashboard-matrix"),

    events: {
        "dragstart .task-col .task-container": "onDragStart",
        "dragleave .task-col": "onDragLeave",
        "dragover .task-col": "onDragOver",
        "drop .task-col": "onDrop",

        "click .task-col .task-container .icons .assigned-to": "assignationChangeClick",
        "change .task-col .task-container .icons .participants": "assignationChangeSelect",
    },

    initialize: function() {
        _.bindAll(this, 'render', 'addOne', 'addAll', 'onDrop',
                        'onDragOver', 'onDragLeave', 'onDragStart',
                        'assignationChangeClick', 'assignationChangeSelect');
        var self = this;

        this.user_stories = new UserStoryCollection();
        this.user_stories_views = new Array();

        _(this.$("tr.user-story-row")).each(function(item) {
            var item = $(item);
            var model_instance = new UserStory({html: item.html(), id: item.attr('ref')})
            var view_instance = new UserStoryView({model:model_instance});
            
            self.user_stories.add(model_instance);
            self.user_stories_views.push(view_instance);
        })

        this.user_stories.bind('add', this.addOne);
    },

    assignationChangeClick: function(event) {
        var self = $(event.currentTarget);
        var current_person_id = self.attr('ref');
        var select_dom_copy = $("#templates select.participants").clone();
        if (current_person_id) {
            select_dom_copy.val(current_person_id);
        }

        self.replaceWith(select_dom_copy);
    },

    assignationChangeSelect: function(event) {
        var self = $(event.currentTarget);
        var selected_person_id = self.val();
        var selected_person_name = self.find('option:selected').html();
        var url = self.closest(".task-container").attr('reasign_url');

        var new_dom_attrs = {'ref': selected_person_id, 'class': 'assigned-to'};
        var new_dom = this.make('div', new_dom_attrs, selected_person_name);

        $.post(url, {userid:selected_person_id}, function(data) {
            if (data.valid) {
                self.replaceWith(new_dom);
            }
        }, 'json');
    },

    onDragStart: function(event) {
        var self = $(event.currentTarget);
        event.originalEvent.dataTransfer.effectAllowed = 'copy';
        event.originalEvent.dataTransfer.setData('source_id', self.attr('id'));
    },

    onDragLeave: function(event) {
        var self = $(event.currentTarget);
        if (self.hasClass('drag-over')) {
            self.removeClass('drag-over');
        }
    },

    onDragOver: function(event) {
        event.originalEvent.dataTransfer.dropEffect = 'copy';
        event.preventDefault();
        var self = $(event.currentTarget);
        
        if (!self.hasClass("drag-over")) {
            self.addClass("drag-over");
        }
    },

    onDrop: function(event) {
        var self = $(event.currentTarget);
        
        if (self.hasClass('drag-over')) {
            self.removeClass('drag-over');
        }

        var source_id = event.originalEvent.dataTransfer.getData('source_id');
        var source = $("#" + source_id);
        var source_parent = source.closest('td');

        var userstory = self.closest('tr');
        var userstory_id = userstory.attr('ref');

        // Move dom
        self.append(source);

        var url = source.attr('alter_url');
        var data = {
            'status': self.attr('tstatus')
        };

        if (userstory_id) {
            data['us'] = userstory_id;
        }

        $.post(url, data, function(data) {
            if (!data.valid) {
                source_parent.append(source);
            }
        }, 'json');


    },


    addOne: function(item) {
        var view = new UserStoryView({model:item});
        this.$("table tbody").append(view.render().el);
    },

    addAll: function() {
        this.user_stories.each(this.addOne);
    },

    render: function() {},
});

$(function() {
    var dashboard = new DashboardView();
});
