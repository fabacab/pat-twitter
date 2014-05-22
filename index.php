<?php
require_once('lib/httpclient/http.php');
require_once('lib/php-oauth-api/oauth_client.php');
require_once('lib/twitter-api-php/TwitterAPIExchange.php');
require_once('lib/pat-twitter/PATTwitter.class.php');
require_once('lib/pat-twitter/PATTwitterTemplate.class.php');

// Pick up app credentials and database connection URL.
if (is_readable('pat_twitter_config.ini.php')) {
    $config = parse_ini_file('pat_twitter_config.ini.php');
} else {
    $config = array(
        'consumer_key'    => getenv('TWITTER_CONSUMER_KEY'),
        'consumer_secret' => getenv('TWITTER_CONSUMER_SECRET'),
        'database_url'    => getenv('DATABASE_URL'),
        'theme_folder'    => getenv('PAT_TWITTER_THEME_FOLDER')
    );
}

$PAT_Twitter = new PAT_Twitter($config['database_url'], $config['consumer_key'], $config['consumer_secret']);
$PAT_Twitter->template = new PAT_Twitter_Template(dirname(__FILE__) . '/themes/' . $config['theme_folder']);

// Only take actions if we detect a logged in user (valid cookies, mostly).
if ($PAT_Twitter->getCurrentUser()) {
    if (isset($_POST['do']) && isset($_GET['what'])) {
        switch ($_POST['do']) {
            case 'subscribe':
            case 'resync':
                $PAT_Twitter->$_POST['do']($_POST['what']);
                break;
            case 'new':
                $PAT_Twitter->create($_POST['what']); // "new" is a PHP reserved word
                break;
        }
    }

    if (isset($_GET['action'])) {
        switch ($_GET['action']) {
            // TODO: Implement SQRL login for "anonymous" users?
            case 'loggedout':
                $PAT_Twitter->template->add_notice('You have been logged out.');
                break;
            default:
                $PAT_Twitter->doAction($_GET['action']);
                break;
        }
    }
} else if (isset($_GET['action']) && 'login' === $_GET['action']) {
    $PAT_Twitter->login();
}

$PAT_Twitter->template->render();
