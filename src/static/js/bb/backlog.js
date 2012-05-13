/* Backlog Stats */

var StatsModel = Backbone.Model.extend({
    url: function() {
        return this.get('view').$el.attr('url');
    }
});

var StatsView = Backbone.View.extend({
    el: $(".user-story-stats"),

    initialize: function() {
        _.bindAll(this, 'render');
        this.model = new StatsModel({view:this});
    },

    render: function() {
        var self = this,
            deff = this.model.fetch();

        deff.done(function() {
            self.$el.html(self.model.get('stats_html'));
        });
    }
});

/* Unassigned user storyes (left block) */

var LeftBlockModel = Backbone.Model.extend({
    url: function() {
        return this.get('view').$el.attr('url');
    }
});

var LeftBlockView = Backbone.View.extend({
    el: $(".left-block"),

    events: {
        "dragstart .unassigned-us .un-us-item": "unassigned_us_dragstart",
        "dragover .left-block .unassigned-us": "left_block_dragover",
        "dragleave .left-block .unassigned-us": "left_block_dragleave",
        "drop .left-block .unassigned-us": "left_block_drop",

        /* Iniline edit */
        "click .unassigned-us .config-us-inline": "on_us_edit_inline",
        "click .unassigned-us .user-story-inline-submit": "on_us_edit_inline_submit",
        "click .unassigned-us .user-story-inline-cancel": "on_us_edit_form_cancel",

        "click .un-us-item .delete": "unassign_us",
    },

    initialize: function() {
        _.bindAll(this, 'render', 'rehash');
        this.model = new LeftBlockModel({view:this});
        this.model.on('change', this.render);
        this.model.fetch();
    },

    render: function() {
        this.$('.unassigned-us').html(this.model.get('html'))
    },


    /*
     * Reload state fetching new content from server. 
    */

    rehash: function() {    
        this.model.fetch({success:this.render});
    },


    /* 
     * On click to delete button on unassigned user story list. 
    */

    unassign_us: function(event) {
        event.preventDefault();
        var self = $(event.currentTarget);
        var buttons = {};
        buttons[gettext('Delete')] = function() {
            $(this).dialog('close');
            $.post(self.attr('href'), {}, function(data) {
                console.log(data);
                self.parents('.un-us-item').remove();
            });
        };

        buttons[gettext('Cancel')] = function() {
            $(this).dialog('close');
        };

        $(".delete-us-dialog").dialog({
            modal: true,
            width: '220px',
            buttons: buttons
        });
    },

    left_block_drop: function(event) {
        var self = $(event.currentTarget);
        if (self.hasClass('drag-over')) {
            self.removeClass('drag-over');
        }
        
        var source_id = event.originalEvent.dataTransfer.getData('source_id');
        var source = $("#" + source_id);
        var unassign_url = source.attr('unassignurl');

        $.post(unassign_url, {}, function(data) {
            self.append(data);
            if(source.parent().find(".us-item").length == 1) {
                source.find(".us-meta").remove()
                source.find(".us-title").html(gettext("No user storys"));
                source.addClass('us-item-empty');
                source.attr('draggable', 'false');
                source.attr('unassignurl', '');
            } else {
                source.remove();
            }
        }, 'html');

        // Refresh stats
        this.options.stats_view.render();
    },
    
    left_block_dragleave: function(event) {
        var self = $(event.currentTarget);
        if (self.hasClass('drag-over')) {
            self.removeClass('drag-over');
        }
        event.preventDefault();
    },
    
    left_block_dragover: function(event) {
        var self = $(event.currentTarget);
        event.originalEvent.dataTransfer.dropEffect = 'copy';
        event.preventDefault();
    },

    unassigned_us_dragstart: function(event) {
        var self = $(event.currentTarget);
        event.originalEvent.dataTransfer.effectAllowed = 'copy'; // only dropEffect='copy' will be dropable
        event.originalEvent.dataTransfer.setData('source_id', self.attr('id')); // required otherwise doesn't work
    },

    /*
     * On request visualize a inline edit user story form.
    */

    on_us_edit_inline: function(event) {
        event.preventDefault();
        var self = $(event.currentTarget);
        $.get(self.attr('href'), function(data) {
            self.closest('.un-us-item').find('.form-inline').html(data).show();
        }, 'html');
    },

    /*
     * On inline user story edit form submit changes
    */

    on_us_edit_inline_submit: function(event) {
        event.preventDefault();
        var self = $(event.currentTarget),
            form = self.closest('form');

        $.post(form.attr('action'), form.serialize(), function(data) {
            if (data.valid) {
                var usitem = self.closest('.un-us-item');
                usitem.find('.form-inline').hide();

                if (data.action == 'save') {
                    usitem.replaceWith(data.html);
                } else {
                    var ml_id = form.find("#id_milestone").val();
                    var milestone = $("#milestone-" + ml_id);

                    // hide empty entries.
                    milestone.find(".us-item-empty").remove()
                    milestone.find(".milestone-userstorys").append(data.html);
                    usitem.remove();
                }
            } else {
                form.find('.errorlist').remove();
                $.each(data.errors, function(index, value) {
                    var ul = $(document.createElement('ul'))
                        .attr('class', 'errorlist');
                    for(var i=0; i<value.length; i++){
                        $(document.createElement('li')).html(value[i]).appendTo(ul);
                    }
                    
                    form.find('[name='+index+']').before(ul);
                });
            }
        }, 'json');

        // Refresh stats
        this.stats_view.render();
    },

    on_us_edit_form_cancel: function(event) {
        event.preventDefault();
        var self = $(event.currentTarget);
        self.closest('.un-us-item').find('.form-inline').hide();
    },
});


/* Milestones (right block) */

var MilestonesModel = Backbone.Model.extend({
    url: function() {
        return this.get('view').$el.attr('url');
    }
});

var RightBlockView = Backbone.View.extend({
    el: $(".right-block"),

    events: {
        "dragover .milestones .milestone-item": "milestones_dragover",
        "dragleave .milestones .milestone-item": "milestones_drageleave",
        "drop .milestones .milestone-item": "milestones_on_drop",
        "dragstart .milestones .us-item": "milestones_dragstart",

        /* Milestone delete */
        "click .milestone-item .milestone-title a.delete": "on_milestone_delete_click"
    },

    initialize: function() {
        _.bindAll(this, 'render');
        this.model = new MilestonesModel({view:this});
        this.model.on('change', this.render);
        this.model.fetch();
    },

    render: function() {
        var self = this;
        self.$(".milestones").html(this.model.get('html'));
    },

    milestones_dragover: function(event) {
        event.originalEvent.dataTransfer.dropEffect = 'copy';
        event.preventDefault();

        var self = $(event.currentTarget);

        if (!self.hasClass("drag-over")) {
            self.addClass("drag-over");
        }
    },

    milestones_drageleave: function(event) {
        event.preventDefault();

        var self = $(event.currentTarget);
        if (self.hasClass('drag-over')) {
            self.removeClass('drag-over');
        }
    },

    milestones_on_drop: function(event) {
        var self = $(event.currentTarget);
        if (self.hasClass('drag-over')) {
            self.removeClass('drag-over');
        }

        var source_id = event.originalEvent.dataTransfer.getData('source_id');
        var source = $("#" + source_id);
        var assign_url = source.attr('assignurl');
        var milestone_id = self.attr('ref');

        $.post(assign_url, {mid: milestone_id}, function(data) {
            var data_object = $(data);
            self.find(".us-item-empty").remove()
            self.find(".milestone-userstorys").append(data_object);
            source.remove()
        }, 'html');

        // Refresh stats
        this.options.stats_view.render();
    },

    milestones_dragstart: function(event) {
        var self = $(event.currentTarget);
        event.originalEvent.dataTransfer.effectAllowed = 'copy'; 
        event.originalEvent.dataTransfer.setData('source_id', self.attr('id'));
    },

    on_milestone_delete_click: function(event) {
        event.preventDefault();
        var self = $(event.currentTarget)
            , buttons = {}
            , left_block = this.options.parent.left_block;
    
        var buttons = {};
        buttons[gettext('Delete')] = function() {
            $(this).dialog('close');
            $.post(self.attr('href'), {}, function(data) {
                if (data.valid) {
                    self.parents('.milestone-item').remove();
                }
                
                left_block.rehash();
            }, 'json');
        };

        buttons[gettext('Cancel')] = function() {
            $(this).dialog('close'); 
        };

        $(".delete-milestone-dialog").dialog({
            modal: true,
            width: '220px',
            buttons: buttons
        });
    }
});

var Backlog = Backbone.View.extend({
    el: $("#dashboard"),

    initialize: function() {
        _.bindAll(this, 'render');
        
        var stats_view = new StatsView();
        stats_view.render();

        this.left_block = new LeftBlockView({stats_view:stats_view, parent:this});
        this.right_block = new RightBlockView({stats_view:stats_view, parent:this});
    },

    render: function() {},
});

$(function() {
    var backlog = new Backlog();
});