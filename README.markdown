# Predator Alert Tool for Twitter - README

The Predator Alert Tool for Twitter is an add-on to your Web browser that enables you to subscribe to and view warnings about other Twitter users published by sources whose judgement you trust. It also enables you to create and optionally publish your own warnings, or "Predator Alerts," so you can share them with people who trust you.

![Screenshot showing Predator Alert Tool for Twitter main user interface.](http://maymay.net/blog/wp-content/uploads/2014/05/predator-alert-tool-for-twitter-mockup.png)

* **The Predator Alert Tool for Twitter integrates cleanly into Twitter’s own Web interface.** No separate app to use. Once installed, just use Twitter.com as you normally would.
* You gain **two new types of lists** in addition to regular Twitter Lists: a “Twitter Blocklist” and any number of “warnlists.”
    * Your *Twitter Blocklist* shows you all of the Twitter users you’ve blocked in one place.
    * Your *warnlists* are where you publish your “Predator Alerts” and where you subscribe to Predator Alerts from others. If a tweet shows in any of your timelines from a user who is on a warnlist you’ve subscribed to, their tweet gets “redboxed.” In infamous Predator Alert Tool style, click through to that user’s profile to read details of each alert published about that user.
* Unlike regular Twitter Lists, **Twitter users can not remove themselves from Predator Alert Tool warnlists that you add them to**, and taking a page from [Predator Alert Tool for Facebook](https://github.com/meitar/pat-facebook/#readme)'s book, you can add users you have blocked or users who have blocked you to warnlists that you make.
* **Subscribe to alerts from sources you trust.** You always have the final say; as a fully decentralized system, [unlike the Block Bot](http://days.maybemaimed.com/post/76147235230/brainstorm-predator-alert-tool-for-craigslist), this system offers no ability for others to moderate what you publish and thus it has a vastly reduced vulnerability to corruption by social cliques and their inevitable groupthink.

## Overview

Unlike Twitter itself, Predator Alert Tool for Twitter is an [unhosted](http://unhosted.org/) Web app. This means that there isn't just one place where Predator Alerts are published, nor only one place to get a copy of the Predator Alert Tool for Twitter browser app. Instead, anyone who wants to can host their own "alert facilitator" (using software included in this package) to create and distribute alerts for their friends and community. Doing so also makes your website a distribution point of the Predator Alert Tool for Twitter browser add-on. Each facilitation server automatically generates the necessary customizations to the Predator Alert Tool for Twitter browser app that pairs it with the server that distributed it.

In other words, if you want to maintain a semi-private community warnlist, you or a friend can run your own such website for this purpose. This is called "running a facilitator." For more information about operating a Predator Alert Tool for Twitter facilitator, see [Installing a facilitator](#installing-a-facilitator).

## System requirements

### PAT Twitter user script (browser app)

The following software must be installed on your system before installing the Predator Alert Tool for Twitter user script.

#### Mozilla Firefox

If you use the [Mozilla Firefox](http://getfirefox.com/) web browser (version 22 or higher), ensure you have the [Greasemonkey extension](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/) installed (at version 1.0 or higher).

#### Google Chrome

If you use the [Google Chrome](https://chrome.google.com/) web browser (version 29 or higher), ensure you have the [Tampermonkey extension](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) installed.

### PAT Twitter facilitator server (website)

* PostgreSQL 9.0 or higher
* PHP 5.2 or higher
* Web server, like Apache (2.0 or higher) or Lighttpd

Note that while MySQL is theoretically supported (through PEAR's MDB2 database abstraction layer), I've done no testing for that configuration. Testers and patches are welcome.

## Installing a facilitator

The easiest way to set up your own Predator Alert Tool for Twitter facilitator is by deploying one to the Heroku cloud application platform. First, [ensure you have `git` installed](https://help.github.com/articles/set-up-git) on your computer. Then, [install the Heroku toolbelt](https://toolbelt.heroku.com/).

Next, [clone](http://git-scm.com/book/en/Git-Basics-Getting-a-Git-Repository#Cloning-an-Existing-Repository) the Predator Alert Tool for Twitter repository and [create a new Heroku app](https://devcenter.heroku.com/articles/creating-apps):

    git clone https://github.com/meitar/pat-twitter.git
    cd pat-twitter
    heroku apps:create

You'll need to tell Twitter about your new facilitator by [creating a Twitter app](https://twitter.com/login?redirect_after_login=https%3A//apps.twitter.com/app/new) in order to [obtain a Twitter API key](https://dev.twitter.com/docs/faq#7447). For the purposes of Predator Alert Tool for Twitter, none of the information Twitter asks for makes any difference, so enter whatever you like.

Once you have your app's API key and API secret from Twitter, you can install them into your Predator Alert Tool for Twitter facilitator by setting them as environment variables:

    heroku config:set TWITTER_API_KEY=YOUR_API_KEY_HERE
    heroku config:set TWITTER_API_SECRET=YOUR_API_SECRET_HERE

Predator Alert Tool for Twitter ships with an extremely simple template called "default." Activate it as follows:

    heroku config:set PAT_TWITTER_THEME_FOLDER=default

If you want to change the look and feel of your facilitator, you can copy this template (located in the app's `themes/` folder), modify it, and set the `PAT_TWITTER_THEME_FOLDER` environment variable to your new folder's name.

Finally, [provision a database for your facilitator](https://devcenter.heroku.com/articles/heroku-postgresql#provisioning-the-add-on):

    heroku addons:add heroku-postgresql:dev

(Note that [Heroku's free database tier has certain limitations](https://devcenter.heroku.com/articles/heroku-postgres-plans). If you plan to run a fully public or popular Predator Alert Tool for Twitter facilitator, I recommend you move to a production-grade plan. Alternatively, you can run the server on most standard Web hosting plans.)

You can navigate to your app by using the `heroku open` command. This should open your default browser and present you with a login screen.

Congratulations. You are now a Predator Alert Tool for Twitter facilitator. Share the URL of your app with anyone you want to and [encourage them to break the silence around and cycle of abuse](https://github.com/meitar/pat-facebook/wiki/How-to-help).
