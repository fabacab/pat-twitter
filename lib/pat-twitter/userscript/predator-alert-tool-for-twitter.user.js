/**
 * This is a Greasemonkey script and must be run using a Greasemonkey-compatible browser.
 *
 * Predator Alert Tool for Twitter
 *
 * Written by Meitar Moscovitz <meitar@maymay.net>
 *
 * To the extent possible under law, the author(s) have dedicated all copyright
 * and related and neighboring rights to this software to the public domain
 * worldwide. This software is distributed without any warranty.
 *
 * You should have received a copy of the CC0 Public Domain Dedication along
 * with this software. If not, see
 *     http://creativecommons.org/publicdomain/zero/1.0/
 *
 * @author maymay <bitetheappleback@gmail.com>
 */
// ==UserScript==
// @name           Predator Alert Tool for Twitter
// @version        0.1.3
// @namespace      __PAT_TWITTER_CLIENT_NAMESPACE__.pat.twitter
// @updateURL      __PAT_TWITTER_CLIENT_HOME_URL__?action=download&what=userscript.user.js
// @description    Alerts you of Twitter users who your friends have flagged on Twitter.
// @include        https://twitter.com/*
// @include        https://apps.twitter.com/app/*/keys
// @include        __PAT_TWITTER_CLIENT_HOME_URL__*
// @exclude        https://twitter.com/logout
// @grant          GM_log
// @grant          GM_xmlhttpRequest
// @grant          GM_addStyle
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_listValues
// @grant          GM_deleteValue
// @grant          GM_openInTab
// @require        https://code.jquery.com/jquery-2.1.1.min.js
// @require        https://crypto-js.googlecode.com/svn/tags/3.1.2/build/rollups/hmac-sha1.js
// @require        https://crypto-js.googlecode.com/svn/tags/3.1.2/build/components/enc-base64-min.js
// @require        __PAT_TWITTER_CLIENT_INCLUDE_URL__/oauth-1.0a/oauth-1.0a.js
// @require        https://netdna.bootstrapcdn.com/bootstrap/3.1.1/js/bootstrap.min.js
// @require        https://cdnjs.cloudflare.com/ajax/libs/flight/1.1.4/flight.min.js
// ==/UserScript==

var PATTwitter = {};
PATTwitter.CONFIG = {
    'debug': false // Switch to true to debug.
};
// This is set by the PAT Twitter distribution pod.
PATTwitter.CONFIG['home_url'] = '__PAT_TWITTER_CLIENT_HOME_URL__';
PATTwitter.run = {}; // "Global" runtime variables.
PATTwitter.run.hook_logout = true;

// Utility debugging function.
PATTwitter.log = function (x) {
    if (!PATTwitter.CONFIG.debug) { return; }
    var out;
    if ('string' === typeof(x)) {
        out = 'PAT-Twitter: ' + x;
    } else {
        out = x;
    }
    if (console && console.log) { console.log(out); }
    else { GM_log(out); }
};
PATTwitter.log('I am starting up.');
//
// Global utility functions.
//
function getCookie (n) {
    try {
        return unescape(document.cookie.match('(^|;)?'+n+'=([^;]*)(;|$)')[2]);
    } catch (e) {
        return null;
    }
};
function parseUrl (str) {
    var a = document.createElement('a');
    a.setAttribute('href', str);
    return {
        'protocol': a.protocol,
        'hostname': a.hostname,
        'port'    : a.port,
        'pathname': a.pathname,
        'search'  : a.search,
        'hash'    : a.hash,
        'host'    : a.host
    };
};

PATTwitter.log('Parsed global scope utilities.');

//
// Program simple getters and setters.
//
PATTwitter.getMyTwitterId = function () {
    var x = jQuery('.js-mini-current-user').data('user-id');
    if (x) {
        return x;
    } else if (getCookie('twid')) {
        return getCookie('twid').match(/(\d+)("$|\|)/)[1];
    } else if (getCookie('PAT_Twitter\\[twitter_id]')) {
        return getCookie('PAT_Twitter\\[twitter_id]');
    } else {
        PATTwitter.log('Unable to find my Twitter ID.');
        return false;
    }
};
PATTwitter.getMyTwitterScreenName = function () {
    return jQuery('.js-mini-current-user').data('screen-name');
};
PATTwitter.getMyTwitterAvatarUrl = function () {
    return jQuery('.js-mini-current-user img').attr('src');
};
PATTwitter.getValue = function (name, default_value) {
    return GM_getValue(PATTwitter.getMyTwitterId() + '_' + name, default_value);
};
PATTwitter.setValue = function (name, value) {
    return GM_setValue(PATTwitter.getMyTwitterId() + '_' + name, value);
};
PATTwitter.deleteValue = function (name) {
    return GM_deleteValue(PATTwitter.getMyTwitterId() + '_' + name);
};
PATTwitter.listValues = function () {
    ks = [];
    GM_listValues().forEach(function (k) {
        if (0 === k.indexOf(PATTwitter.getMyTwitterId())) {
            ks.push(k.replace(PATTwitter.getMyTwitterId() + '_', ''));
        }
    });
    return ks;
};
PATTwitter.getStoredValuesByPattern = function (pattern) {
    var vals = [];
    PATTwitter.listValues().forEach(function (k) {
        if (k.match(pattern)) {
            vals.push(k);
        }
    });
    return vals;
};
PATTwitter.getLists = function () {
    var names = PATTwitter.getStoredValuesByPattern(/^list_/);
    var lists = [];
    for (var i = 0; i < names.length; i++) {
        lists.push(new PATTwitter.List(names[i].replace(/^list_/, '')));
    }
    return lists;
};
PATTwitter.getMyLists = function () {
    var lists = PATTwitter.getLists();
    var my_lists = [];
    for (var i = 0; i < lists.length; i++) {
        if (lists[i].data.author.twitter_id == PATTwitter.getMyTwitterId()) {
            my_lists.push(lists[i]);
        }
    }
    return my_lists;
};
PATTwitter.getFlaggedUsers = function (autoload) {
    var twits = PATTwitter.getStoredValuesByPattern(/^predator_/);
    var users = {};
    twits.forEach(function (x) {
        var twitter_id = x.match(/^predator_(.*)/)[1];
        users[twitter_id] = {};
        if (true === autoload) {
            users[twitter_id] = new PATTwitter.Predator(twitter_id);
        } else {
            var tmp = new PATTwitter.Predator(twitter_id);
            users[twitter_id]['screen_name'] = tmp.screen_name;
        }
    });
    return users;
};
PATTwitter.showInstallSplash = function () {
    return PATTwitter.getValue('showInstallSplash', true);
};

PATTwitter.log('Parsed program simple getters and setters.');

//
// Classes.
//
PATTwitter.List = function (list_name, data) {
    this.local_key = list_name;
    this.data = data;
    return this.load();
};
PATTwitter.List.prototype = Object.create(PATTwitter.List);

PATTwitter.List.load = function () {
    try {
        var obj = JSON.parse(PATTwitter.getValue('list_' + this.local_key, false));
    } catch (e) {
        PATTwitter.log('Error loading list ' + this.local_key);
        return false
    }
    for (x in obj) {
        this[x] = obj[x];
    }
    return this;
};
PATTwitter.List.save = function () {
    try {
        PATTwitter.setValue('list_' + this.local_key, JSON.stringify(this));
        return true;
    } catch (e) {
        PATTwitter.log('Error saving list.')
        PATTwitter.log(e);
        return false;
    }
};
PATTwitter.List.delete = function () {
    PATTwitter.log('Deleting list ' + this.data.list_name);
    if (this.listed_users) {
        var known_predators = PATTwitter.getStoredValuesByPattern(/^predator/);
        for (var i = 0; i < known_predators.length; i++) {
            for (x in this.listed_users) {
                if (known_predators[i].replace('predator_', '') === x) {
                    var p = new PATTwitter.Predator(x);
                    for (var i_alert = 0; i_alert < p.alerts.length; i_alert++) {
                        if (p.alerts[i_alert].alert_list === this.data.list_name) {
                            p.removeAlert(i_alert); // pass array index only
                        }
                    }
                    p.save();
                }
            }
        }
    }
    // Finally, delete the list.
    PATTwitter.deleteValue('list_' + this.local_key);
};
PATTwitter.List.currentUserIsAuthor = function () {
    if (this.data && this.data.author) {
        return (this.data.author.twitter_id == PATTwitter.getMyTwitterId()) ? true : false;
    } else {
        return false;
    }
};
PATTwitter.List.addPredator = function (predator) {
    if (!this.listed_users) {
        this.listed_users = {};
    }
    this.listed_users[predator.twitter_id] = predator;
};
PATTwitter.List.publish = function () {
    PATTwitter.log('Publishing list ' + this.data.list_name + ' as horcruxes.');
    var this_list = this;
    if (this.data && this.data.horcruxes) {
        for (var i = 0; i < this.data.horcruxes.length; i++) {
            var data = 'do=new&what=list&name=' + encodeURIComponent(this.data.list_name);
            data += '&desc=' + encodeURIComponent(this.data.list_desc);
            (function (index) {
                PATTwitter.talkToServer(
                    this_list.data.horcruxes[index].server_url,
                    {
                        'endpoint': '?action=view&what=list',
                        'data': data,
                        'onload': function (response) {
                            // TODO:
                            // Handle error where facilitator server is not available or user is not logged in!
                            PATTwitter.log('Parsed response from server at ' + this_list.data.horcruxes[index].server_url);
                            PATTwitter.log(response);
                            this_list.data.horcruxes[index].id = response.list_info.id;
                            this_list.data.horcruxes[index].last_modified = response.list_info.last_modified;
                            this_list.data.horcruxes[index].creation_time = response.list_info.creation_time;
                            this_list.save();
                        }
                    }
                );
            })(i);
        }
    }
};
PATTwitter.List.isPublished = function () {
    return (this.data.horcruxes) ? true : false;
};
PATTwitter.List.refresh = function () {
    if (window.confirm('You are about to import the "' + this.data.list_name + '" warnlist. You can remove it at any time.')) {
        var server_url = this.data.horcruxes[0].server_url;
        var list_id = this.data.horcruxes[0].id;
        this.importFromServer(server_url, {
            'endpoint': '?action=view&what=list&id=' + list_id
        });
    }
};
PATTwitter.List.importFromServer = function (server_url, details) {
    PATTwitter.talkToServer(server_url, {
        'endpoint': details.endpoint,
        'onload': function (response) {
            var list_data = {
                'list_name': response.list_info.list_name,
                'visibility': 'public',
                'list_type': response.list_info.list_type,
                'list_desc': response.list_info.list_desc,
                'author': response.list_info.author,
                'horcruxes': [{'server_url': server_url, 'id': response.list_info.id}]
            };
            var list = new PATTwitter.List(list_data.list_name + '_' + list_data.author.twitter_id, list_data);
            list.listed_users = {};
            for (var i = 0; i < response.listed_users.length; i++) {
                list.listed_users[response.listed_users[i].twitter_id] = response.listed_users[i];
            }
            list.addListedAlerts();
            if (list.save()) {
                PATTwitter.log('Warnlist ' + list.data.list_name + ' imported successfully.');
                jQuery('#pat-twitter-stream-item-list-' + PATTwitter.UI.helpers.slugify({'name': list.data.list_name})).trigger('redraw');
            }
            PATTwitter.refreshRedboxes();
        }
    });
};
PATTwitter.List.addListedAlerts = function () {
    for (x in this.listed_users) {
        // TODO: What if there are more than one alert per user on one list?
        // Currently that's not possible but....
        var twit = new PATTwitter.Predator(x);
        var alert = this.listed_users[x];
        alert.alert_list = this.data.list_name;
        twit.addAlert(this.listed_users[x]);
        twit.save();
    }
};
PATTwitter.List.export = function () {
    // TODO: Maybe we shouldn't load other lists' data at all?
    // This list will load predators from other lists,
    // so we need to remove the alerts from other lists.
    for (x in this.listed_users) {
        var indexes = [];
        // TODO: Figure out why some lists have this and others don't. :(
        if (this.listed_users[x].alerts) {
            for (var i = 0; i < this.listed_users[x].alerts.length; i++) {
                if (this.listed_users[x].alerts[i].alert_list === this.data.list_name) { continue; }
                else { indexes.push(i); }
            }
            for (var i = 0; i < indexes.length; i++) {
                this.listed_users[x].alerts.splice(indexes[i], 1);
            }
        }
    }
    var url = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this));
    GM_openInTab(url);
};

PATTwitter.List.Blocklist = function () {
    PATTwitter.log('Creating new Twitter Blocklist.')
    this.local_key = 'Twitter Blocklist';
    this.type = 'twitter_blocklist';
};
PATTwitter.List.Blocklist.prototype = Object.create(PATTwitter.List.Blocklist);

PATTwitter.Predator = function (twitter_id) {
    this.twitter_id = twitter_id;
    this.load();
};
PATTwitter.Predator.prototype = Object.create(PATTwitter.Predator);

PATTwitter.Predator.load = function () {
    try {
        var obj = JSON.parse(PATTwitter.getValue('predator_' + this.twitter_id, false));
    } catch (e) {
        PATTwitter.log('Error loading Predator ' + this.twitter_id);
        return false
    }
    this.screen_name = obj.screen_name;
    this.alerts = obj.alerts;
    return true;
};
PATTwitter.Predator.save = function () {
    if (!this.alerts || (0 === this.alerts.length)) {
        PATTwitter.deleteValue('predator_' + this.twitter_id);
        return true;
    }
    try {
        PATTwitter.setValue('predator_' + this.twitter_id, JSON.stringify(this));
        return true;
    } catch (e) {
        PATTwitter.log('Error saving list.')
        PATTwitter.log(e);
        return false;
    }
};
PATTwitter.Predator.addAlert = function (obj) {
    PATTwitter.log('Adding alert with data: (shown on next line)');
    PATTwitter.log(obj);
    if (!this.alerts) {
        this.alerts = [];
    }
    var now = new Date;
    if (!obj.last_modified) { obj.last_modified = now.getTime(); }
    if (!obj.creation_time) { obj.creation_time = now.getTime(); }
    if (!obj.alerted_by) { obj.alerted_by = PATTwitter.getMyTwitterId(); }
    for (var i = 0; i < this.alerts.length; i++) {
        if (obj.id && this.alerts[i].id && obj.id === this.alerts[i].id) {
            PATTwitter.log('Refusing to add duplicate alert ' + obj.id + '.');
            return false;
        }
    }
    // If this was added to a public list, publish the alert, too.
    var list = new PATTwitter.List(obj.alert_list + '_' + obj.alerted_by);
    if (list.currentUserIsAuthor() && list.isPublished()) {
        for (var i = 0; i < list.data.horcruxes.length; i++) {
            this.publishAlert(obj, list.data.horcruxes[i]);
        }
    }
    this.alerts.push(obj);
    return true;
};
PATTwitter.Predator.removeAlert = function (i) {
    this.alerts.splice(i, 1); // modify array in-place
};
PATTwitter.Predator.publishAlert = function (alert_obj, horcrux) {
    var data = 'do=new&what=alert&who=' + encodeURIComponent(this.twitter_id);
    data += '&where=' + encodeURIComponent(horcrux.id);
    data += '&data[alert_desc]=' + encodeURIComponent(alert_obj.alert_desc);
    PATTwitter.talkToServer(horcrux.server_url, {
        'endpoint': '?action=view&what=alert',
        'data': data,
        'onload': function (response) {
            // TODO Error handling or something?
            PATTwitter.log('Got response from server: (shown in next line)');
            PATTwitter.log(response);
        }
    });
};

PATTwitter.log('Parsed program prototypes.');

//
// Twitter interface integration.
//
PATTwitter.UI = {};              // FlightJS components and such.
PATTwitter.UI.helpers = {};      // Helpers for quickly injecting HTML.
PATTwitter.UI.helpers.slugify = function (item) {
    var str = item.name || '';
    str = str.replace(/\W/g, '-');
    return str;
};
PATTwitter.UI.Templates = {};    // Stores template HTML for UI components.
PATTwitter.UI.Templates.Tags = {
    '%PAT_TWITTER_PREFIX%'          : function () { return 'pat-twitter-'; },
    '%PAT_TWITTER_ITEM_ID%'         : function (item_info) { return item_info.id || ''; },
    '%PAT_TWITTER_ITEM_NAME%'       : function (item_info) { return item_info.name || ''; },
    '%PAT_TWITTER_ITEM_SLUG%'       : PATTwitter.UI.helpers.slugify,
    '%PAT_TWITTER_ITEM_TYPE%'       : function (item_info) { return item_info.type || ''; },
    '%PAT_TWITTER_ITEM_VISIBILITY%' : function (item_info) { return item_info.visibility || ''; },
    '%PAT_TWITTER_ITEM_SERVER_URL%' : function (item_info) { return item_info.server_url || ''; },
    '%PAT_TWITTER_ITEM_DESCRIPTION%': function (item_info) { return item_info.desc || ''; },
    '%PAT_TWITTER_ITEM_LAST_MODIFIED%': function (item_info) { return item_info.last_modified || ''; },
    '%PAT_TWITTER_ITEM_CREATION_TIME%': function (item_info) {
        if (item_info.creation_time) {
            return (new Date(item_info.creation_time)).toDateString();
        }
    },
    '%PAT_TWITTER_ITEM_COUNT%': function (item_info) { return item_info.count || 0; },
    '%PAT_TWITTER_USER_ID%'            : function (item_info) { return item_info.user_id || ''; },
    '%PAT_TWITTER_USER_SCREEN_NAME%'   : function (item_info) { return item_info.screen_name || ''; },
    '%PAT_TWITTER_USER_AVATAR_URL%'    : function (item_info) { return item_info.avatar_url || ''; },
    '%PAT_TWITTER_MY_USER_ID%'         : PATTwitter.getMyTwitterId,
    '%PAT_TWITTER_MY_USER_SCREEN_NAME%': PATTwitter.getMyTwitterScreenName,
    '%PAT_TWITTER_MY_USER_AVATAR_URL%' : PATTwitter.getMyTwitterAvatarUrl
};
PATTwitter.UI.Templates.predator_alert_container = '\
<div id="predator-alerts-container" class="ProfileHeaderCard">\
    <h1>Predator Alert!</h1>\
    <ol id="predator-alerts-list">\
        <!-- Alerts go here. -->\
    </ol>\
</div>';
PATTwitter.UI.Templates.predator_alert = '\
<li>\
    <ul>\
        <li>Alert list: %PAT_TWITTER_ITEM_NAME%</li>\
        <li>Alert content: %PAT_TWITTER_ITEM_DESCRIPTION%</li>\
        <li>Alert created on: %PAT_TWITTER_ITEM_CREATION_TIME%</li>\
    </ul>\
</li>';
PATTwitter.UI.Templates.dashboard_list_stat = '\
<li id="pat-twitter-pat-lists" class="DashboardProfileCard-stat Arrange-sizeFit">\
    <a class="DashboardProfileCard-statLink u-textCenter u-textUserColor u-linkClean u-block" title="%PAT_TWITTER_ITEM_COUNT% PAT Lists" href="https://twitter.com/%PAT_TWITTER_MY_USER_SCREEN_NAME%/lists#pat-twitter-twitter-blocklist">\
        <span class="DashboardProfileCard-statLabel u-block">PAT Lists</span>\
        <span class="DashboardProfileCard-statValue u-block">%PAT_TWITTER_ITEM_COUNT%</span>\
    </a>\
</li>';
PATTwitter.UI.Templates.home_server_link = '<li role="presentation"><a href="' + PATTwitter.CONFIG.home_url + '">My Predator Alert Tool for Twitter</a></li>';
PATTwitter.UI.Templates.install_splash = '\
<div id="pat-twitter-install-splash-dialog" class="modal-container pat-twitter-modal-container">\
    <div class="close-modal-background-target"></div>\
    <div class="modal modal-medium draggable" id="pat-twitter-install-splash-modal" tabindex="-1" role="dialog" aria-labelledby="pat-twitter-install-splash-modal" aria-hidden="true">\
        <div class="modal-dialog">\
            <div class="modal-content">\
                <button class="modal-btn modal-close js-close" type="button" data-dismiss="modal">\
                    <span class="Icon Icon--close Icon--medium">\
                        <span class="visuallyhidden">Close</span>\
                    </span>\
                </button>\
                <div class="modal-header">\
                    <h4 class="modal-title" id="pat-twitter-install-splash-modal-title">Congratulations! You successfully installed<br /><a href="' + PATTwitter.CONFIG.home_url + '">Predator Alert Tool for Twitter</a></h4>\
                </div>\
                <div class="modal-body">\
                    <h3>What is Predator Alert Tool for Twitter?</h3>\
                    <p>Predator Alert Tool for Twitter empowers you to <strong>document harassment on Twitter</strong> and alert others about predatory users. What constitutes "predatory" is entirely up to you; the software makes no claim as to what behavior hurts you. Predator Alert Tool for Twitter can be used to, for example, flag trolls, <a href="https://apps.facebook.com/predator-alert-tool/">warn your followers about rapists</a>, or to <a href="https://apps.facebook.com/cop-block-tool/">expose cops and snitches who use social media</a>.</p>\
                    <p><strong>What you share can not be censored or removed by Twitter itself</strong> because Twitter is never informed of your report. Predator Alert Tool for Twitter is part of <a href="http://days.maybemaimed.com/post/69212634122/predator-alert-tool-co-creators-aim-to-build-sexual">an Internet-wide anti-abuse effort</a>. The "report abuse" button on websites should go to the rest of the user community, not just the site admins.</p>\
                    <h3>How to use Predator Alert Tool for Twitter</h3>\
                    <p>Predator Alert Tool for Twitter adds a number of features and functions to the Twitter website. Learn more:</p>\
                    <ul>\
                        <li><a href="https://github.com/meitar/pat-twitter/wiki/User-Manual">Read the friendly user manual</a></li>\
                        <li><a href="https://github.com/meitar/pat-twitter/wiki/Frequently-Asked-Questions">Frequently Asked Questions</a></li>\
                    </ul>\
                    <h3>Support this tool! (Or complain to the developers.)</h3>\
                    <p>Predator Alert Tool for Twitter is a 100% volunteer project. There are no paid developers. There is no staff. There is also no budget.</p>\
                    <p>If you find Predator Alert Tool for Twitter useful, please consider <a href="http://Cyberbusking.org/">making a donation to its homeless, nomadic developer</a>.</p>\
                    <p>Likewise, send complaints to <a href="https://twitter.com/maymaymx">@maymaymx</a>.</p>\
                </div>\
                <div class="modal-footer">\
                    <button type="button" class="btn btn-primary" data-dismiss="modal">Close</button>\
                </div>\
            </div>\
        </div>\
    </div>\
</div>';
PATTwitter.UI.Templates.twitter_list = '\
<div role="presentation" class="Grid">\
    <div data-item-type="list" id="%PAT_TWITTER_PREFIX%stream-item-list-%PAT_TWITTER_ITEM_SLUG%" data-list-id="%PAT_TWITTER_ITEM_ID%" data-list-author-id="%PAT_TWITTER_USER_ID%" data-list-name="%PAT_TWITTER_ITEM_NAME%" role="listitem" data-test-selector="ProfileTimelineList" class="Grid-cell u-size3of3 u-mb10 js-stream-item">\
        <div data-server-url="%PAT_TWITTER_ITEM_SERVER_URL%" data-list-id="%PAT_TWITTER_ITEM_ID%" data-user-id="%PAT_TWITTER_USER_ID%" class="ProfileListItem u-cf js-list">\
            <a href="#pat-twitter-list-members-%PAT_TWITTER_ITEM_SLUG%" class="ProfileListItem-name js-list-link js-nav">%PAT_TWITTER_ITEM_NAME%</a>\
            <a aria-hidden="true" tabindex="-1" href="/%PAT_TWITTER_USER_SCREEN_NAME%" class="ProfileListItem-avatarLink u-textUserColor u-pullRight">\
                <img alt="" src="%PAT_TWITTER_USER_AVATAR_URL%" class="ProfileListItem-avatar">\
            </a>\
            <span class="Icon Icon--%PAT_TWITTER_ITEM_TYPE%" title="Predator Alert Tool List"></span>\
            <span class="u-isHiddenVisually">Predator Alert Tool List</span>\
            <p dir="ltr" class="ProfileListItem-bio u-dir">%PAT_TWITTER_ITEM_DESCRIPTION%</p>\
            <p class="ProfileListItem-memberCount">%PAT_TWITTER_ITEM_COUNT% members</p>\
            <p class="pat-twitter-ProfileListItem-actions-container">\
                <button class="btn small js-refresh-list-action visuallyhidden">Refresh from Predator Alert Tool server</button>\
                <button class="btn small js-export-list-action">Export</button>\
                <button class="btn small js-delete-list-action">Delete</button></p>\
        </div><!-- .ProfileListItem -->\
    </div><-- .Grid-cell -->\
</div><!-- .Grid -->';
PATTwitter.UI.Templates.list_members = '\
<div class="modal-container pat-twitter-modal-container in" id="pat-twitter-list-members-%PAT_TWITTER_ITEM_SLUG%" style="display: none;" aria-hidden="true">\
    <div class="close-modal-background-target"></div>\
    <div class="modal modal-medium draggable">\
        <div class="modal-content">\
            <button class="modal-btn modal-close js-close" type="button">\
                <span class="Icon Icon--close Icon--medium">\
                    <span class="visuallyhidden">Close</span>\
                </span>\
            </button>\
            <div class="modal-header">\
                <h3 class="modal-title">Members of %PAT_TWITTER_ITEM_NAME% (%PAT_TWITTER_ITEM_COUNT% total)</h3>\
            </div>\
            <div class="modal-body">\
                <div class="pat-twitter-list-members">\
                    <p>%PAT_TWITTER_ITEM_DESCRIPTION%</p>\
                    <ul>\
                        <!-- List members inserted dynamically. -->\
                    </ul>\
                </div>\
            </div>\
        </div>\
    </div>\
</div>';
PATTwitter.UI.Templates.list_members_list_item = '\
<li>\
    <a href="/%PAT_TWITTER_USER_SCREEN_NAME%">@%PAT_TWITTER_USER_SCREEN_NAME%</a>\
</li>';
PATTwitter.UI.Templates.list_membership_list_item = '\
<li data-list-id="%PAT_TWITTER_ITEM_SLUG%" data-list-name="%PAT_TWITTER_ITEM_NAME%" class="">\
    <span class="spinner-small loading-spinner"></span>\
    <input type="checkbox" id="list_%PAT_TWITTER_ITEM_SLUG%" class="membership-checkbox">\
    %PAT_TWITTER_ITEM_NAME%\
    <span class="icon sm-lock %PAT_TWITTER_ITEM_VISIBILITY%" title="Private List"></span>\
    <span class="icon sm-%PAT_TWITTER_ITEM_TYPE%" title="Predator Alert Tool List"></span>\
</li>';
PATTwitter.UI.Templates.add_alert_to_list = '\
<div class="modal-container pat-twitter-modal-container in" id="pat-twitter-add-alert-to-list-dialog" aria-hidden="true">\
    <div class="close-modal-background-target"></div>\
    <div class="modal modal-medium draggable">\
        <div class="modal-content">\
            <div class="modal-header">\
                <h3 class="modal-title">Add @%PAT_TWITTER_USER_SCREEN_NAME% to "%PAT_TWITTER_ITEM_NAME%"</h3>\
            </div>\
            <div class="modal-body">\
                <div class="list-editor">\
                    <div class="field">\
                        <label for="pat-twitter-alert-description" class="t1-label">Description</label>\
                        <textarea style="height: 100px;" name="pat-twitter-alert-description" id="pat-twitter-alert-description"></textarea>\
                        <span class="help-text">Optionally, provide additional information for why you are adding this user to this list. Take screenshots of harassing tweets or other supporting context and include the URLs of those screenshots or any other information in this box.</span>\
                    </div>\
                </div>\
                <div class="list-editor-save">\
                    <button data-list-name="%PAT_TWITTER_ITEM_NAME%" data-list-id="list_%PAT_TWITTER_ITEM_SLUG%" data-user-id="%PAT_TWITTER_USER_ID%" data-screen-name="%PAT_TWITTER_USER_SCREEN_NAME%" class="btn btn-primary add-alert-button" type="button">Save alert</button>\
                </div>\
            </div>\
        </div>\
    </div>\
</div>';

PATTwitter.UI.injectElement = function (tag, attrs, inner_html, append_to_el) {
    var el = document.createElement(tag);
    for (x in attrs) {
        el.setAttribute(x, attrs[x]);
    }
    el.innerHTML = inner_html;
    append_to_el.appendChild(el);
};
PATTwitter.UI.injectTemplate = function (name, params, ref_el, injectMethod) {
    var injectMethod = injectMethod || 'appendTo';
    var t = PATTwitter.UI.Templates[name];
    var tags = PATTwitter.UI.Templates.Tags;
    for (x in tags) {
        t = t.replace(new RegExp(x, 'g'), tags[x](params));
    }
    return jQuery(t)[injectMethod](ref_el);
};
PATTwitter.UI.brainwashNodes = function (el) {
    // Prepend our own id attributes.
    el.find('[id]').each(function () {
        jQuery(this).attr('id', 'pat-twitter-' + jQuery(this).attr('id'));
    });
    // And names.
    el.find('[name]').each(function () {
        jQuery(this).attr('name', 'pat-twitter-' + jQuery(this).attr('name'));
    });
    // And any form labels.
    el.find('[for]').each(function () {
        jQuery(this).attr('for', 'pat-twitter-' + jQuery(this).attr('for'));
    });
};
// UI components for the Twitter "Dashboard" section.
PATTwitter.UI.Dashboard = {};
PATTwitter.UI.Dashboard.init = function () {
    // The idea behind interface initialization is to take these steps:
    //     1. Flush out old interface components.
    //     2. Inject HTML templates so we have the needed markup.
    //     3. Optionally, define and attach Flight JS components.

    // Flush old dashboard list stat.
    jQuery('#pat-twitter-pat-lists').remove();

    // Inject the dashboard list stat.
    PATTwitter.UI.injectTemplate('dashboard_list_stat', {
        'count': PATTwitter.getLists().length
    }, document.querySelector('.DashboardProfileCard-statList'));
};

PATTwitter.UI.ListsPage = {};
PATTwitter.UI.ListsPage.injectListTemplate = function (list) {
    var count = (list.listed_users) ? Object.keys(list.listed_users).length : 0;
    var template_params = {
            'name': list.data.list_name,
            'desc': list.data.list_desc,
            'type': list.data.list_type,
            'count': count,
            'user_id': list.data.author.twitter_id,
            'screen_name': list.data.author.twitter_screen_name,
            'avatar_url': list.data.author.twitter_data.profile_image_url_https,
    };
    if (list.isPublished()) {
        // TODO: Hmm, just one remote?
        template_params['server_url'] = list.data.horcruxes[0].server_url;
        template_params['id'] = list.data.horcruxes[0].id;
    }
    var t = PATTwitter.UI.injectTemplate('twitter_list', template_params, jQuery('.GridTimeline-items'));
    // TODO: Twitter Blocklist UI?
//    if (t.find('.Icon--twitter_blocklist').length) {
//        t.attr('id', 'pat-twitter-twitter-blocklist');
//        t.find('.js-refresh-list-action').text('Resync with Twitter');
//        t.find('.js-refresh-list-action').on('click', function () {
//            PATTwitter.resyncBlocklist();
//        });
//    }

    // Only inject this HTML based on certain logic.
    if (!list.isPublished()) {
        jQuery('<span class="Icon Icon--protected" title="Private List"></span><span class="u-isHiddenVisually">Private List</span>')
            .insertBefore(t.find('.Icon'));
    } else {
        t.find('.js-refresh-list-action').removeClass('visuallyhidden');
    }

    var patListsTwitterListComponent = flight.component(function () {
        this.captureClick = function (e) {
            e.stopPropagation();
        };

        this.onClick = function (e) {
            var info_el = this.$node.find('[role="listitem"]').first();
            var list = new PATTwitter.List(info_el.data('list-name') + '_' + info_el.data('list-author-id'));

            // When the list name link is clicked
            if (jQuery(e.target).is('.ProfileListItem-name')) {
                var diag = jQuery('#pat-twitter-list-members-' + PATTwitter.UI.helpers.slugify({'name': info_el.data('list-name')}));
                for (x in list.listed_users) {
                    if (0 === diag.find('.pat-twitter-list-members a[href^="/' + list.listed_users[x].screen_name + '"]').length) {
                        PATTwitter.UI.injectTemplate('list_members_list_item', {
                            'screen_name': list.listed_users[x].screen_name
                        }, diag.find('.pat-twitter-list-members ul'));
                    }
                }
                diag.find('button.modal-close').on('click', function (e) {
                    diag.modal('hide');
                });
                diag.modal();
            }

            // When the delete button is clicked
            if (jQuery(e.target).is('.js-delete-list-action')) {
                list.delete();
                this.$node.remove();
            }
            // When the refresh button is clicked
            if (jQuery(e.target).is('.js-refresh-list-action')) {
                this.$node.find('.ProfileListItem-memberCount').html('Refreshing&hellip;');
                list.refresh();
            }

            if (jQuery(e.target).is('.js-export-list-action')) {
                list.export();
            }
        };

        this.onRedraw = function (e) {
            PATTwitter.log('Redrawing list...');
            var info_el = this.$node.find('[role="listitem"]').first();
            var list = new PATTwitter.List(info_el.data('list-name') + '_' + info_el.data('list-author-id'));
            this.$node.find('.ProfileListItem-memberCount').html(Object.keys(list.listed_users).length + ' members');
            if (list.isPublished()) {
                this.$node.find('.Icon--protected').remove();
            }
        };

        this.onShowError = function (e, error_data) {
            PATTwitter.log('Showing error data on list action:');
            PATTwitter.log(error_data);
            this.$node.find('.ProfileListItem-memberCount').html('An error occurred: ' + error_data.message);
        };

        this.after('initialize', function () {
            // First, prevent Twitter's event delegate from seeing this click.
            this.on('click', this.captureClick);

            this.on('click', this.onClick);
            this.on('redraw', this.onRedraw);
            this.on('showError', this.onShowError);
        });
    });
    patListsTwitterListComponent.attachTo(t);
    return t;
};
PATTwitter.UI.ListsPage.injectListMembersDialog = function (list) {
    var template_params = {
        'name': list.data.list_name,
        'desc': list.data.list_desc,
        'count': (list.listed_users) ? Object.keys(list.listed_users).length : 0,
    };
    var t = PATTwitter.UI.injectTemplate('list_members', template_params, jQuery('body'));
};
PATTwitter.UI.ListsPage.init = function () {
    PATTwitter.log('Initializing Lists Page user interface.');
    // Flush old list operations and creation components.
    if (
        0 < jQuery('#pat-twitter-list-operations-dialog').length
        ||
        0 < jQuery('.pat-twitter-ListCreationModule').length
    ) {
        jQuery('#pat-twitter-list-operations-dialog').remove();
        jQuery('.pat-twitter-ListCreationModule').remove();
    }
    jQuery('[data-list-author-id]').each(function () {
        jQuery(this).parent().remove();
    });
    // Clone Twitter's "list operations dialog" for us to use.
    // This widget uses Bootstrap JS to show/hide, etc.
    var el_dialog = jQuery('#list-operations-dialog').clone();
    el_dialog.attr('id', 'pat-twitter-' + el_dialog.attr('id'));
    el_dialog.attr('class', el_dialog.attr('class') + ' pat-twitter-' + el_dialog.attr('class'));
    PATTwitter.UI.brainwashNodes(el_dialog);
    el_dialog.find('.modal-title').text('Create a new PAT Twitter list');
    el_dialog.find('button.modal-close').on('click', function (e) {
        jQuery('#pat-twitter-list-operations-dialog').modal('toggle'); // .modal('hide') doesn't seem to work?
    });
    var html = jQuery('<ul id="pat-twitter-list-source-options" class="ProfileHeading-toggle">\
        <li class="ProfileHeading-toggleItem is-active">\
            <a href="#pat-twitter-list-name" id="pat-twitter-new-blank-list-toggle" title="Create a new, empty PAT Twitter list.">New blank list</a>\
        </li>\
        <li class="ProfileHeading-toggleItem">\
            <a href="#pat-twitter-list-file" id="pat-twitter-import-from-file-toggle" title="Create a new list from a previously exported file.">Import from file</a>\
        </li>\
    </ul>');
    html.insertBefore(el_dialog.find('.field').first());
    el_dialog.find('.field').wrapAll('<div class="pat-twitter-source-option-new"></div>');
    var html = jQuery('<div class="pat-twitter-source-option-file visuallyhidden">\
        <div class="field">\
            <label for="pat-twitter-list-file" class="t1-label">PAT Twitter List:</label>\
            <input id="pat-twitter-list-file" class="file" type="file" name="pat-twitter-file" />\
        </div>\
    \</div>');
    html.insertAfter(el_dialog.find('.pat-twitter-source-option-new'));
    el_dialog.find('#pat-twitter-list-source-options').on('click', function (e) {
        jQuery(e.target).parent().addClass('is-active');
        jQuery(e.target).parent().siblings().removeClass('is-active');

        var which_option = e.target.getAttribute('id');
        if (which_option.match(/new-blank-list/)) {
            jQuery('#pat-twitter-list-operations-dialog').find('.pat-twitter-source-option-new').removeClass('visuallyhidden');
            jQuery('#pat-twitter-list-operations-dialog').find('.pat-twitter-source-option-file').addClass('visuallyhidden');
        }
        if (which_option.match(/import-from-file/)) {
            jQuery('#pat-twitter-list-operations-dialog').find('.pat-twitter-source-option-new').addClass('visuallyhidden');
            jQuery('#pat-twitter-list-operations-dialog').find('.pat-twitter-source-option-file').removeClass('visuallyhidden');
        }
    });
    el_dialog.on('reset', function (e) {
        PATTwitter.log('Reseting list operations dialog UI...');
        var ui_el_dialog = jQuery('#pat-twitter-list-operations-dialog');
        ui_el_dialog.find('[disabled]').removeAttr('disabled');
        ui_el_dialog.find('input, textarea').val('');
        ui_el_dialog.find('button.update-list-button').html('Save list');
    });
    el_dialog.find('button.update-list-button').on('click', function () {
        el_dialog.trigger('save');
    });
    el_dialog.appendTo(document.body);

    var dialogComponent = flight.component(function () {
        this.onSave = function (e) {
            var btn = this.$node.find('button.update-list-button');
            btn.prop('disabled', true);
            btn.html('Saving&hellip;');
            var dialog_component = this;
            // If we're being asked to import a file...
            if (window.location.hash.match(/list-file/)) {
                var f = jQuery('#pat-twitter-list-file').get(0).files[0];
                var reader = new FileReader();
                reader.onloadend = function () {
                    try {
                        var json = JSON.parse(this.result);
                    } catch (e) {
                        PATTwitter.log('Error parsing file ');
                        PATTwitter.log(e);
                    }
                    var list = new PATTwitter.List(json.local_key, json.data);
                    list.listed_users = json.listed_users;
                    list.addListedAlerts();
                    if (list.save()) {
                        btn.html('List saved!');
                        // Then, one second later, dismiss the dialog.
                        dialog_component.$node.find('button.modal-close').click();
                        btn.prop('disabled', false);
                        btn.html('Save list');
                        dialog_component.$node.trigger('resetUI');
                        PATTwitter.UI.ListsPage.injectListTemplate(list);
                        PATTwitter.UI.ListsPage.injectListMembersDialog(list);
                        // Focus on the new list in the browser...
                        var url = 'https://twitter.com/'
                            + PATTwitter.getMyTwitterScreenName() + '/lists'
                            + '#pat-twitter-stream-item-list-' + PATTwitter.UI.helpers.slugify({'name': list.data.list_name});
                        window.location.href = url;
                    }
                    PATTwitter.refreshRedboxes();
                };
                reader.readAsText(f);
            } else { // otherwise, do the "normal" blank list save
                var field_els = this.$node.find('input, textarea');
                var list_info = {};
                var do_save_list = false;
                // Do the save stuff.
                field_els.each(function () {
                    switch(jQuery(this).attr('name')) {
                        case 'pat-twitter-name':
                            list_info.list_name = jQuery(this).val();
                            break;
                        case 'pat-twitter-description':
                            list_info.list_desc = jQuery(this).val();
                            break;
                        case 'pat-twitter-mode':
                            if (jQuery(this).is(':checked')) {
                                if ('public' === jQuery(this).val()) {
                                    // TODO: Nicer UI?
                                    if (window.confirm('Public lists are published immediately and cannot be deleted. Are you sure you want to create a public list?')) {
                                        list_info.visibility = 'public';
                                        list_info.horcruxes = [
                                            {
                                                'server_url' : PATTwitter.CONFIG.home_url,
                                                'list_name'  : list_info.list_name
                                            }
                                        ];
                                        do_save_list = true;
                                    } else {
                                        btn.prop('disabled', false);
                                        btn.html('Save list');
                                        return;
                                    }
                                } else {
                                    list_info.visibility = 'private';
                                    do_save_list = true;
                                }
                            }
                            break;
                    }
                });
                // TODO: Implement other types of lists?
                list_info.list_type = 'warn';
                list_info.author = {
                    'twitter_id'         : PATTwitter.getMyTwitterId(),
                    'twitter_screen_name': PATTwitter.getMyTwitterScreenName(),
                    'twitter_data': {
                        'profile_image_url_https': PATTwitter.getMyTwitterAvatarUrl()
                    }
                };
                if (do_save_list) { // confirmed, do save this list.
                    var list = new PATTwitter.List(list_info.list_name + '_' + list_info.author.twitter_id, list_info);
                    // If the save was successful
                    if (list.save()) {
                        if (list.data.horcruxes) {
                            list.publish();
                        }
                        btn.html('List saved!');
                        // Then, one second later, dismiss the dialog.
                        this.$node.find('button.modal-close').click();
                        btn.prop('disabled', false);
                        btn.html('Save list');
                        this.$node.trigger('resetUI');
                        PATTwitter.UI.ListsPage.injectListTemplate(list);
                        PATTwitter.UI.ListsPage.injectListMembersDialog(list);
                        // Focus on the new list in the browser...
                        var url = 'https://twitter.com/'
                            + PATTwitter.getMyTwitterScreenName() + '/lists'
                            + '#pat-twitter-stream-item-list-' + PATTwitter.UI.helpers.slugify({'name': list.data.list_name});
                        window.location.href = url;
                    }
                }
            }
        };

        this.onResetUI = function (e) {
            this.$node.find('input:not([type="radio"]), textarea').each(function () {
                jQuery(this).val('');
            });
            this.$node.find('[disabled]').each(function () {
                jQuery(this).removeAttr('disabled');
            });
            this.$node.find('#pat-twitter-list-source-options li').removeClass('is-active');
            this.$node.find('#pat-twitter-list-source-options li:first-child').addClass('is-active');
            this.$node.find('.list-editor > div:not(.list-editor-save)').addClass('visuallyhidden');
            this.$node.find('.list-editor > div').first().removeClass('visuallyhidden');
        };

        this.after('initialize', function () {
            this.on('save', this.onSave);
            this.on('resetUI', this.onResetUI);
        });
    });
    dialogComponent.attachTo(el_dialog);

    // Clone Twitter's "List Creation Module" component.
    // We use this to show the "list operations dialog" we just cloned.
    var el = jQuery('.ListCreationModule').first().clone();
    el.attr('class', 'pat-twitter-' + el.attr('class'));
    el.find('.ListCreationModule-title').text('Create a PAT Twitter list');
    el.find('.ListCreationModule-description').text('A PAT Twitter list is a way to group alerts about dangerous, predatory, or harassing behavior on Twitter and share that information with other users. ');
    el.find('.ListCreationModule-description').append('<a href="https://github.com/meitar/pat-twitter/wiki/User-Manual:Using-PAT-Twitter-Lists" class="ListCreationModule-moreInfoLink">More info</a>');
    var btn = el.find('.ListCreationModule-action button');
    btn.text('Create new PAT Twitter list');
    btn.on('click', function (e) {
        jQuery('#pat-twitter-list-operations-dialog').modal();
    });
    el.appendTo(jQuery('.ListCreationModule').first().parent());

    // Now inject the HTML based on any saved lists we already have.
    if (window.location.pathname.match(/lists$/)) {
        PATTwitter.getLists().forEach(function (list) {
            PATTwitter.UI.ListsPage.injectListTemplate(list);
            PATTwitter.UI.ListsPage.injectListMembersDialog(list);
        });
    }
};

PATTwitter.UI.ProfilePage = {};
PATTwitter.UI.ProfilePage.ListMembership = {};
PATTwitter.UI.ProfilePage.ListMembership.init = function () {
    var lists = PATTwitter.getMyLists();
    for (var i = 0; i < lists.length; i++) {
        (function (i) {
            var li = PATTwitter.UI.injectTemplate('list_membership_list_item', {
                    'name': lists[i].data.list_name,
                    'visibility': lists[i].data.visibility,
                    'type': lists[i].data.list_type
                }, jQuery('.list-membership-container')
            );
            var listMembershipComponent = flight.component(function () {
                this.captureClick = function (e) {
                    e.stopPropagation();
                };

                this.onClick = function (e) {
                    // Get the user information to add.
                    var twitter_id = this.$node.parents('.list-membership-container').data('user-id');
                    var screen_name = this.$node.parents('.list-membership-content').find('.add-to-list-prompt b').text();
                    var t = PATTwitter.UI.injectTemplate('add_alert_to_list', {
                        'user_id': twitter_id,
                        'name': this.$node.data('list-name'),
                        'screen_name': screen_name
                    }, document.body);
                    t.modal();
                    t.find('button.add-alert-button').on('click', function (e) {
                        var twit = new PATTwitter.Predator(jQuery(this).data('user-id'));
                        twit.screen_name = jQuery(this).data('screen-name');
                        var alert_desc = jQuery('#pat-twitter-alert-description').val();
                        twit.addAlert({'alert_list': jQuery(this).data('list-name'), 'alert_desc': alert_desc});
                        if (twit.save()) {
                            // If we successfully saved this alert,
                            // add this user to said list, itself.
                            // TODO: This `lists[i]` variable is from the init loop, localize?
                            lists[i].addPredator(twit);
                            lists[i].save();
                            if (!jQuery('#' + jQuery(this).data('list-id')).is(':checked')) {
                                jQuery('#' + jQuery(this).data('list-id')).prop('checked', true);
                            }
                            jQuery('#' + jQuery(this).data('list-id')).prop('disabled', true);
                            jQuery('.list-membership-container li[data-list-name="' + jQuery(this).data('list-name') + '"]').unbind();
                            jQuery('.list-membership-container li[data-list-name="' + jQuery(this).data('list-name') + '"]').on('click', listMembershipComponent.captureClick);
                            t.modal('toggle');
                            PATTwitter.refreshRedboxes();
                        }
                    });
                };

                this.after('initialize', function () {
                    // First, prevent Twitter's event delegate from seeing this click.
                    this.on('click', this.captureClick);

                    // If this user is already on the given list, checkmark it.
                    if (lists[i].listed_users && lists[i].listed_users[jQuery('.user-actions').first().data('user-id')]) {
                        this.$node.find('input').prop('checked', true);
                        this.$node.find('input').prop('disabled', true);
                    } else { // otherwise, process a click.
                        this.on('click', this.onClick);
                    }
                });
            });
            listMembershipComponent.attachTo(li);
        })(i);
    };
};

PATTwitter.UI.showInstallSplash = function () {
    var t = PATTwitter.UI.injectTemplate('install_splash', {}, document.body);
    t.modal();
    PATTwitter.setValue('showInstallSplash', false); // Don't show again.
};

PATTwitter.UI.init = function () {
    // Show introductory splash screen?
    if (PATTwitter.showInstallSplash()) {
        PATTwitter.UI.showInstallSplash();
    }
    // Start injecting required HTML to attach our own UI stuff.
    if ('/' === window.location.pathname) {
        // This is the "home" page.
        PATTwitter.UI.Dashboard.init();
    } else if (window.location.pathname.match(/lists$/)) {
        // This is the "lists" page.
        PATTwitter.UI.ListsPage.init();
    }

    if (jQuery('[data-name="lists"]').length) {
        var x = PATTwitter.UI.injectTemplate('home_server_link', {}, jQuery('[data-name="lists"]'), 'insertAfter');
    }

    // If we're on the profile page
    if (jQuery('body.ProfilePage').length) {
        // TODO: Add PAT Twitter List functionality into "block or report" dialog.
        // of a flagged user
        var twitter_id = jQuery('.user-actions').data('user-id');
        if (PATTwitter.known_predators[twitter_id]) {
            // add the alerts we know about to their profile page.
            var alerts_container = PATTwitter.UI.injectTemplate('predator_alert_container', {}, jQuery('.ProfileHeaderCard'));
            var predator = new PATTwitter.Predator(twitter_id);
            for (var i = 0; i < predator.alerts.length; i++) {
                (function (i) {
                    PATTwitter.UI.injectTemplate('predator_alert',
                        {'name' : predator.alerts[i].alert_list, 'desc': predator.alerts[i].alert_desc, 'creation_time': predator.alerts[i].creation_time },
                    jQuery('#predator-alerts-list'));
                })(i);
            };
        }
    }

    // Finally, register for any DOM changes. This lets us react
    // appropriately when Twitter changes the page without a reload.
    var MutationObserver = unsafeWindow.MutationObserver || unsafeWindow.WebKitMutationObserver;
    var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.addedNodes) {
                for (var i = 0; i < mutation.addedNodes.length; i++) {
                    if (mutation.addedNodes[i].nodeType === Node.ELEMENT_NODE) {
                        // Uncomment these to help debug the observer.
//                        PATTwitter.log('Observed added node! Info in next line of log.');
//                        PATTwitter.log(mutation.addedNodes[i]);

                        // If the new node is the left Dashboard
                        var x_class = mutation.addedNodes[i].getAttribute('class');
                        if (x_class && x_class.match(/dashboard-left/)) {
                            PATTwitter.UI.Dashboard.init();
                        }
                        if (x_class && ( 'list-membership-container' === x_class ) ) {
                            PATTwitter.UI.ProfilePage.ListMembership.init();
                        }
                        if (window.location.pathname.match(/(lists|memberships)$/) && x_class && ( 'AppContainer' === x_class ) ) {
                            PATTwitter.UI.ListsPage.init();
                        }
                        // Intercept log out of Twitter and log out of facilitator, too.
                        if (jQuery(mutation.addedNodes[i]).find('[action^="/logout"]')) {
                            if (true === PATTwitter.run.hook_logout) {
                                jQuery('#signout-button').on('click', function (e) {
                                    GM_openInTab(PATTwitter.CONFIG.home_url + '?action=logout');
                                });
                                PATTwitter.run.hook_logout = false; // don't hook again
                            }
                        }
                    }
                }
            }
        });
    });
    observer.observe(document.body, {
        'childList': true,
        'subtree': true
    });
};


//
// Twitter API utilities.
//
PATTwitter.API = {}; // API functions.
PATTwitter.API.getConsumer = function () {
    return oauth_consumer = {
        'key'   : PATTwitter.getValue('oauth_consumer_key', false),
        'secret': PATTwitter.getValue('oauth_consumer_secret', false)
    };
};
PATTwitter.API.getTokens = function () {
    return oauth_access = {
        'token'        : PATTwitter.getValue('oauth_access_token', false),
        'token_secret' : PATTwitter.getValue('oauth_access_token_secret', false)
    };
};
PATTwitter.API.haveOAuthCreds = function (obj) {
    for (x in obj) {
        if (!obj[x]) { return false; }
    }
    return true;
};
/**
 * Call Twitter's API returning already-parsed JSON from the response.
 *
 * This function wraps GM_xmlhttpRequest and generates a signed OAuth
 * request that is sent to the Twitter API. Invoke it in the same way
 * you invoke GM_xmlhttpRequest. For instance, to list blocked IDs:
 *
 *     PATTwitter.API.talkToTwitter({
 *         'method': 'GET',
 *         'url': 'blocks/ids',
 *         'onload': function (response) {
 *             // response is now already-parsed JSON.
 *         }
 *     });
 *
 */
PATTwitter.API.talkToTwitter = function (params) {
    params.url = 'https://api.twitter.com/1.1/' + params.url + '.json';

    if (params.api_params) {
        var str = ('GET' === params.method) ? '?' : '';
        for (x in params.api_params) {
            str += x + '=' + params.api_params[x] + '&';
        }
        str = str.substring(0, str.length - 1);

        if ('GET' === params.method) {
            params.url += str;
            params.data = params.api_params; // This line is needed by OAuth 1.0a library.
        } else {
            params.data = str;
        }
    }

    var consumer = PATTwitter.API.getConsumer();
    var oauth_access = PATTwitter.API.getTokens();
    var oauth = OAuth({
        'consumer': {
            'public': consumer.key,
            'secret': consumer.secret
        },
        'signature_method': 'HMAC-SHA1'
    });
    var token = {
        'public': oauth_access.token,
        'secret': oauth_access.token_secret
    };

    params.headers = oauth.toHeader(oauth.authorize(params, token));

    // On successful response, run the callback.
    var callback = params.onload;
    params.onload = function (response) {
        return callback(JSON.parse(response.responseText));
    };
    GM_xmlhttpRequest(params);
};
// This function sets the appropriate Twitter API parameters.
// TODO: This needs to be more user friendly.
PATTwitter.API.init = function () {
    PATTwitter.log('I am about to configure my Twitter API credentials.');
    var oauth_consumer = PATTwitter.API.getConsumer();
    var oauth_tokens = PATTwitter.API.getTokens();

    // TODO: Refactor this consumer key/access token input.
    // If we don't have a consumer, we need to make a new one.
    if (!PATTwitter.API.haveOAuthCreds(oauth_consumer) || !PATTwitter.API.haveOAuthCreds(oauth_tokens)) {
        PATTwitter.log('Wait a minute, I do not have OAuth credentials.');
        if (window.location.pathname.match(/^\/login/) || window.location.pathname.match(/^\/account\/login_verification/)) {
            return {'exit': true}; // We're on the login page, just let the login happen.
        } else {
            // If we're on apps.Twitter.com,
            if (window.location.hostname.match(/apps.twitter.com/) && window.location.pathname.match(/keys$/)) {
                // TODO: Replace with a Flight UI component?
                var key = window.prompt('Enter your API key.')
                PATTwitter.setValue('oauth_consumer_key', key);
                var secret  = window.prompt('Enter your API secret.');
                PATTwitter.setValue('oauth_consumer_secret', secret);
                var tok = window.prompt('Enter your access token.')
                PATTwitter.setValue('oauth_access_token', tok);
                var secret  = window.prompt('Enter your access token secret.');
                PATTwitter.setValue('oauth_access_token_secret', secret);
            } else {
                // TODO: Display "Welcome to PAT Twitter" installation pop-up.
                // Redirect the user to app creation screen.
                // If we're already logged in, just redirect to the new app screen.
                var redir_url;
                if (PATTwitter.getMyTwitterId()) {
                    redir_url = 'https://apps.twitter.com/app/new';
                } else { // If we're not yet logged in,
                    // redirect to the login and then the new apps screen.
                    redir_url = "https://twitter.com/login?redirect_after_login=https%3A//apps.twitter.com/app/new";
                }
                window.location.href = redir_url;
                return {'exit': true};
            }
        }
    }

    return {
        'consumer': oauth_consumer,
        'tokens'  : oauth_tokens
    };
};

PATTwitter.log('Parsed API utilities.');

//
// Helpers.
//
PATTwitter.createBlocklist = function () {
};

PATTwitter.log('Parsed helper functions.');

PATTwitter.resyncBlocklist = function (api_params) {
    jQuery('#pat-twitter-twitter-blocklist').trigger('refreshing');
    // TODO: Refactor cuz 'getList' is not a function.
    var blocklist = PATTwitter.getList({'author_id': PATTwitter.getMyTwitterId(), 'list_name': 'Twitter Blocklist'});
//    var old_list = blocklist;
//    old_list.list_name = blocklist.list_name + '_old';
//    PATTwitter.saveList(old_list); // save a temporary copy in case of error
    if (!api_params) {
        var api_params = {
            'include_entities': false,
            'skip_status'     : true,
            'stringify_ids'   : true
        };
    }
    PATTwitter.API.talkToTwitter({
        'method': 'GET',
        'url': 'blocks/list',
        'api_params': api_params,
        'onload': function (response) {
            if (response.errors) {
                PATTwitter.log('Error receiving blocklist: ' + response.errors[0].message);
                  // TODO: Refactor cuz 'getList' is not a function.
//                var backup_list = PATTwitter.getList({'author_id': blocklist.author_id, 'list_name': blocklist.list_name + '_old'});
//                backup_list.list_name = blocklist.list_name;
//                PATTwitter.saveList(backup_list);
                jQuery('#pat-twitter-twitter-blocklist').trigger('showError', response.errors);
                return;
            }
            if (response.users) {
                response.users.forEach(function (user) {
                    // TODO: Maybe this should actually be like this?
                    //blocklist.listed_users[user.id] = user;
                    blocklist.listed_users.push(user);
                });
            }
            PATTwitter.saveList(blocklist);
            if (0 !== response.next_cursor) {
                PATTwitter.resyncBlocklist({'cursor': response.next_cursor, 'stringify_ids': true}); // continue sync'ing
            } else {
                PATTwitter.log('Blocklist resync complete.');
                jQuery('#pat-twitter-twitter-blocklist').trigger('redraw');
            }
        }
    });
};

PATTwitter.talkToServer = function (server_url, obj) {
    var details = {};
    details['url'] = (server_url) ? server_url : PATTwitter.CONFIG.home_url;
    for (x in obj) {
        if ('endpoint' === x) {
            details['url'] += obj[x];
        } else {
            details[x] = obj[x];
        }
    }
    details.method = (obj.data) ? 'POST' : 'GET';
    details.headers = obj.headers || {
        'Accept': 'application/json'
    };
    if ('POST' === details.method) {
        details.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    var callback = obj.onload;
    details.onload = function (response) {
        return callback(JSON.parse(response.responseText));
    };
    GM_xmlhttpRequest(details);
};


//
// Program initializations.
//
if (window.top !== window.self) { // Don't run in frames.
    PATTwitter.log('In frame on page ' + window.location.href + ' (Aborting.)');
    return;
}
GM_addStyle('\
/* Redbox styling. */\
.pat-twitter-predator-alert { border: 2px solid red !important; }\
.ProfileTweet-originalAuthorLink.pat-twitter-predator-alert { border: none; }\
#predator-alerts-container h1 { color: red; }\
\
.DashboardProfileCard-stat { padding-bottom: .5em; }\
.pat-twitter-modal-container .modal.modal-medium {\
    position: fixed;\
    left: 50%;\
    margin-left: -250px;\
}\
#pat-twitter-install-splash-modal {\
    position: absolute;\
    margin-left: -350px;\
    width: 700px;\
}\
#pat-twitter-install-splash-modal h3 {\
    margin: .5em 0 .75em;\
}\
.pat-twitter-ProfileListItem-actions-container {\
    display: flex;\
    justify-content: center;\
}\
.pat-twitter-ProfileListItem-actions-container button {\
    margin: 0 2px;\
}\
#pat-twitter-twitter-blocklist:target { padding-top: 150px; }\
.Icon--twitter_blocklist::before {\
    content: "\\20e0"; /* Prohibition symbol. */\
    position: relative;\
    bottom: 3px;\
    left: 5px;\
}\
.Icon--warn::before, .icon.sm-warn::before {\
    content: "\\26A0"; /* Warning symbol. */\
    position: relative;\
    bottom: 3px;\
    left: 5px;\
}\
.list-membership-container .icon.sm-lock.public { display: none; }\
.list-membership-container .icon.sm-warn { background-image: none; }\
.ProfilePage .UserActions-moreActions .list-text,\
.blocked .dropdown-menu .list-text,\
.user-actions .dropdown-menu li.pat-twitter-report-text {\
    display: block; /* Always show "add or remove to lists" item */\
}\
#pat-twitter-list-source-options {\
    border-bottom: 1px solid #E1E8ED;\
    margin-bottom: 1em;\
}\
#pat-twitter-list-source-options .is-active a {\
    color: black;\
    cursor: default;\
    text-decoration: none;\
}\
');
PATTwitter.init = function () {
    if (window.location.href.match(new RegExp(PATTwitter.CONFIG.home_url))) {
        PATTwitter.log('I am home!');
        var subscribe_btn = jQuery('#pat-twitter-list-subscribe-button');
        if (subscribe_btn.length) {
            subscribe_btn.on('click', function () {
                if (window.confirm('You are about to import the "' + subscribe_btn.data('list-name') + '" warnlist. You can remove it at any time.')) {
                    var server_url = window.location.protocol
                        + '//' + window.location.host
                        + window.location.pathname;
                    var details = {'endpoint': window.location.search};
                    var list = new PATTwitter.List(subscribe_btn.data('list-name'));
                    list.importFromServer(server_url, details);
                }
            });
            jQuery('.actions.visuallyhidden').removeClass('visuallyhidden');
        }
    } else {
        PATTwitter.log('I was downloaded from: ' + PATTwitter.CONFIG.home_url);
        // TODO:
        // This API configuration needs a better user interface. It's also
        // only necessary if we end up communicating directly with the Twitter API
        // from the browser. But, let's double check, is that really required?
//        var api_result = PATTwitter.API.init();
//        PATTwitter.log('My access credentials are as follows:');
//        PATTwitter.log(api_result);
//        if (api_result.exit) {
//            return; // We're not done with the API setup, so stop.
//        }
        // Once we have API access, we can start constructing our datastore.
        // First, do we have any lists?
        var lists = PATTwitter.getLists();
        if (0 === lists.length && window.location.hostname.match(/apps.twitter.com/)) {
            // We need to return to Twitter's homepage now that we have API keys but no data.
            window.location.href = 'https://twitter.com/';
        } else if (0 === lists.length) {
            // If we have absolutely NO lists, we need to at least start
            // by generating the user's Twitter Blocklist.
            // Or, do we? Can we just communicate with the facilitator for this feature?
            // TODO:
    //        PATTwitter.createBlocklist();
    //        PATTwitter.resyncBlocklist();
        }
    }

    PATTwitter.known_predators = PATTwitter.getFlaggedUsers();
    PATTwitter.UI.init();

    // This observer watches for what we actually want to redbox.
    // Then it calls main(), which actually does the redboxing.
    // TODO: This could actually be refactored somewhat, it's a bit fragile.
    var MutationObserver = unsafeWindow.MutationObserver || unsafeWindow.WebKitMutationObserver;
    var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            for (var i = 0; i < mutation.addedNodes.length; i++) {
                // Skip text nodes.
                if (mutation.addedNodes[i].nodeType == Node.TEXT_NODE) { continue; }
                PATTwitter.main(mutation.addedNodes[i]);
            }
        });
    });
    observer.observe(document.body, {
        'childList': true,
        'subtree': true
    });
    PATTwitter.main(document);
};
window.addEventListener('DOMContentLoaded', PATTwitter.init);
// Intercept log in to Twitter.com and log in on facilitator, too.
window.addEventListener('submit', function (e) {
    if (jQuery(e.target).is('form.signin')) {
        GM_openInTab(PATTwitter.CONFIG.home_url + '?action=login');
    }
});

PATTwitter.refreshRedboxes = function (start_node) {
    var start_node = start_node || document;
    PATTwitter.known_predators = PATTwitter.getFlaggedUsers();
    PATTwitter.main(start_node);
};

// main() is what actually detects flagged users and redboxes them.
// DO. NOT. INJECT. NODES. IN. THIS. FUNCTION. Thank you.
// Unless you want to cause an infinite loop. :P
// TODO: Yeah, refactor that, that's fragile as shit.
PATTwitter.main = function (start_node) {
    PATTwitter.log('Starting main() on page ' + window.location.toString());
    if (0 === Object.keys(PATTwitter.known_predators).length) {
        PATTwitter.log('I have no knowledge of any predator alerts.');
        return;
    }

    PATTwitter.log('Looking for predators in node ' + start_node.nodeName);
    jQuery(start_node).find('[data-user-id]:not([data-user-id=""])').each(function () {
        var twitter_id = jQuery(this).data('user-id');
        if ((PATTwitter.getMyTwitterId() != twitter_id) && PATTwitter.known_predators[twitter_id]) {
            jQuery(this).addClass('pat-twitter-predator-alert');
        }
    });
    jQuery(start_node).find('a[href^="/"]').each(function () {
        for (x in PATTwitter.known_predators) {
            var sn = PATTwitter.known_predators[x].screen_name;
            if ((PATTwitter.getMyTwitterScreenName != sn) && jQuery(this).attr('href').match(new RegExp('^/' + sn, 'i'))) {
                jQuery(this).addClass('pat-twitter-predator-alert');
            }
        }
    });
};
