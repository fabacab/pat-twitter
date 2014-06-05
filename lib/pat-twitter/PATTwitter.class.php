<?php
/**
 * Predator Alert Tool for Twitter
 */

// Dependencies.
require_once(dirname(__FILE__) . '/PATTwitterDatabase.class.php');

// TODO: The oauth_client_class says these should be subclassed
//class PAT_Twitter_OAuth_Client extends oauth_client_class {
//    public function StoreAccessToken ($tokens) {
//        print 'hello world';
//    }
//
//    public function GetAccessToken ($token) {
//    }
//}

class PAT_Twitter {
    private $version = '0.1.3';
    private $echo_debug = false; //< Turn to true to show debug errors.

    private $db;     //< PEAR MDB2 database driver.
    private $client; //< OAuth wrapper.
    // App authentication credentials.
    private $consumer_key;
    private $consumer_secret;
    // User authentication credentials.
    private $access_token;
    private $access_token_secret;

    private $user = false; //< Who is using the app right now?

    public $template; //< PAT_Twitter_Template class.

    public function __construct ($database_url, $consumer_key = '', $consumer_secret = '') {
        date_default_timezone_set('UTC'); // To suppress warnings.
        $this->database_url = (empty($database_url)) ? getenv('DATABASE_URL') : $database_url;
        $this->consumer_key = (empty($consumer_key)) ? getenv('TWITTER_CONSUMER_KEY') : $consumer_key;
        $this->consumer_secret = (empty($consumer_secret)) ? getenv('TWITTER_CONSUMER_SECRET') : $consumer_secret;

        session_start();
        $db = new PAT_Twitter_Database($this->database_url);
        $this->db = $db->getDriver();

        if ($this->isLoggedIn()) {
            // Retrieve and initiatlize user's access tokens.
            $result = $this->db->extended->autoExecute(
                'users',
                null, // SELECT queries do not need manipulation values
                MDB2_AUTOQUERY_SELECT,
                'twitter_id = ' . $this->db->quote($_COOKIE['PAT_Twitter']['twitter_id'], 'text'),
                null, true, true
            );
            $row = $result->fetchRow();
            if ($row) {
                $this->access_token = stream_get_contents($row->twitter_oauth_token);
                $this->access_token_secret = stream_get_contents($row->twitter_oauth_token_secret);
                $this->user = new stdClass();
                if (empty($row->twitter_data)) {
                    $this->user = $this->verifyTwitterData();
                } else {
                    $this->user = json_decode(stream_get_contents($row->twitter_data));
                }
            }
            $result->free();
        }

        return $this;
    }

    private function isLoggedIn () {
        if (
            isset($_COOKIE['PAT_Twitter'])
            &&
            isset($_COOKIE['PAT_Twitter']['twitter_id'])
            &&
            isset($_COOKIE['PAT_Twitter']['access'])
        ) {
            $row = $this->db->extended->getRow(
                'SELECT creation_time, login_hash FROM users WHERE twitter_id = '
                . $this->db->quote($_COOKIE['PAT_Twitter']['twitter_id'], 'integer')
            );
            if (crypt($_COOKIE['PAT_Twitter']['access'] . $row->creation_time, $row->login_hash) === $row->login_hash) {
                return true;
            }
        }
        return false;
    }

    public function getVersion () {
        return $this->version;
    }

    public function getCurrentUser () {
        return ($this->user) ? $this->user: false;
    }

    public function getAllUsersFromCollection ($endpoint, $params, $whose = array()) {
        $users = array();
        do {
            // POST or GET?
            if (is_array($params)) {
                if (isset($cursor)) {
                    $params['cursor'] = $cursor;
                }
            } else {
                // set a cursor if there is one,
                $params .= (isset($cursor)) ? "&cursor=$cursor": '';
                // read the $params string to an array to collapse multiple values into one
                $arr = array();
                parse_str($params, $arr);
                // rewrite the $params string with the array values
                $params = '';
                foreach ($arr as $k => $v) {
                    $params .= "$k=$v&";
                }
                $params = substr($params, 0, -1); // strip trailing ampersand
            }

            // Our own token or someone else's?
            if (empty($whose)) {
                $data = $this->talkToTwitter($endpoint, $params);
            } else {
                $data = $this->talkToTwitter($endpoint, $params, $whose);
            }

            // Did we hit an error?
            if (!empty($data->errors)) {
                foreach ($data->errors as $err) {
                    $this->template->add_notice('Twitter returned an error: ' . $err->message);
                    throw new Exception('Twitter rate limited, can not access needed data.');
                }
                break;
            }
            // Did Twitter respond with metadata?
            if (isset($data->users)) {
                $users = array_merge($users, $data->users);
                $cursor = $data->next_cursor;
            } else if (is_array($data)) { // mostly for 'users/lookup' endpoint.
                $users = array_merge($users, $data);
                break; // there is no cursor here
            }

            // Twitter API pagination; if there is a non-zero cursor, loop again.
        } while (0 !== $data->next_cursor);
        return $users;
    }

    public function resync ($what) {
        $this->resyncTwitterBlocklist($this->user->id);
        $_GET['what'] = $what;
        $_GET['id'] = $this->getMyTwitterBlocklistID();
    }

    private function resyncTwitterBlocklist ($twitter_id) {
        $list_id = $this->findList($twitter_id, 'twitter_blocklist')->id;

        // Get the previously recorded and currently known blocked users.
        $previously_blocked = $this->getUsersOnList($list_id);
        try {
            $currently_blocked = $this->getBlocklist($this->getTwitterTokensFor($twitter_id));

            // Remove alert records for no-longer-blocked users.
            $alerts_to_remove = $this->diffAlerts($previously_blocked, $currently_blocked);
            $this->deleteAlerts($alerts_to_remove);

            // Add any missing alerts.
            // TODO: Currently, PostgreSQL won't allow duplicates to be
            //       inserted but perhaps we should enforce this here?
            $alerts_to_add = $this->prepareAlerts($currently_blocked);
            $this->createAlerts($alerts_to_add, $list_id);
        } catch (Exception $e) {
            $this->template->add_notice('Could not resync your Twitter blocklist. Exception occured: ' . $e->getMessage());
        }
    }

    private function prepareAlerts ($data, $alerted_by = false) {
        $alerted_by = (false === $alerted_by) ? $this->user->id : $alerted_by;
        $alerts = array();
        foreach ($data as $k => $v) {
            $alerts[] = array(
                'twitter_id' => $v->id,
                'twitter_data' => $v,
                'alerted_by' => $alerted_by,
                'last_modified' => gmdate('Y-m-d H:i:s')
            );
        }
        return $alerts;
    }

    private function diffAlerts ($old, $new) {
        // Make comparison lists indexed by alert ID.
        $ids_previously_listed = array();
        $alerts_to_remove = array();
        foreach ($old as $v) {
            $ids_previously_listed[$v->id] = $v->twitter_id;
            $alerts_to_remove[$v->id] = $v;
        }
        // Check each user currently blocked on Twitter
        foreach ($new as $v) {
            if (in_array($v->id, $ids_previously_listed)) {
                // This user is still blocked.
                unset($alerts_to_remove[array_search($v->id, $ids_previously_listed)]);
            }
        }
        return $alerts_to_remove;
    }

    private function deleteAlerts ($alerts = array()) {
        if (empty($alerts)) { return false; }
        $where_clause = 'id IN (';
        $ids = array();
        foreach ($alerts as $alert) {
            $ids[] = $this->db->quote($alert->id, 'integer');
        }
        $where_clause .= implode(',', $ids);
        $where_clause .= ')';
        return $this->db->extended->autoExecute(
            'alerts', null,
            MDB2_AUTOQUERY_DELETE,
            $where_clause
        );
    }

    private function insertAlerts ($alerts = array()) {
        if (!is_array($alerts)) { $alerts = array($alerts); }
        foreach ($alerts as $alert) {
            $fields = array();
            foreach ($alert as $k => $v) {
                $fields[$k] = $v;
            }
            $fields['twitter_data'] = json_encode($fields['twitter_data']);
            $result = $this->db->extended->autoExecute(
                'alerts', $fields,
                MDB2_AUTOQUERY_INSERT,
                null
            );
        }
    }

    private function getBlocklist ($whose = false) {
        return $this->getAllUsersFromCollection('blocks/list', '?skip_status=true', $whose);
    }

    public function getFollowing ($whose = false) {
        $users = $this->getAllUsersFromCollection('friends/list', '?count=200&skip_status=true', $whose);
        // We can only see the block lists of users who are using this app,
        // so for each user, check to see if they're also a user.
        foreach ($users as $usr) {
            if ($this->getTwitterTokensFor($usr->id)) {
                $usr->pat_twitter_enabled = true;
            } else {
                $usr->pat_twitter_enabled = false;
            }
        }
        return $users;
    }

    // Mostly a debug function.
    public function getMyRateLimitInfo () {
        var_dump($this->talkToTwitter('application/rate_limit_status', '?'));
        exit();
    }

    // For getting user info from our database.
    private function findUser ($where) {
        return $this->db->extended->autoExecute(
            'users',
            null, // SELECT queries do not need manipulation values
            MDB2_AUTOQUERY_SELECT,
            $where,
            null, true, true
        );
    }

    private function findAlert ($where) {
        return $this->db->extended->autoExecute(
            'alerts',
            null, // SELECT queries do not need manipulation values
            MDB2_AUTOQUERY_SELECT,
            $where,
            null, true, true
        )->fetchRow();
    }

    private function updateAlert ($id, $fields = array()) {
        return $this->db->extended->autoExecute(
            'alerts',
            $fields,
            MDB2_AUTOQUERY_UPDATE,
            'id = ' . $this->db->quote($id, 'integer')
        );
    }

    // This is actually used for resyncing a blocklist.
    // It can't be called from the public API.
    private function deleteAlert ($id) {
        return $this->db->extended->autoExecute(
            'alerts', null,
            MDB2_AUTOQUERY_DELETE,
            'id = ' . $this->db->quote($id, 'integer')
        );
    }

    // For getting user info from Twitter's API.
    private function lookupUsers ($who = array()) {
        if (is_string($who)) {
            $who = explode(',', $who);
        }
        // TODO:
        // Split big $who values into batches of 100, as that's Twitter's limit.
        // @see https://dev.twitter.com/docs/api/1.1/get/users/lookup
        // NOTE: For some reason this doesn't work with POST requests
        //       (using an array as the second parameter) and I think
        //       that this is a bug.
        //       See:
        //       https://github.com/J7mbo/twitter-api-php/issues/70
        return $this->getAllUsersFromCollection('users/lookup', '?skip_status=true&user_id=' . implode(',', $who));
    }

    private function validateListType ($str) {
        switch ($str) {
            // TODO: Uhhhh...what are list types for again?
            case 'warn':
            case 'block':
            case 'twitter_blocklist':
                $type = $str;
                break;
            default:
                $type = false;
        }
        return $type;
    }

    public function getTwitterLists () {
        return $this->talkToTwitter('lists/list', '?user_id=' . $this->user->id);
    }

    public function getMyLists () {
        $result = $this->db->extended->autoExecute(
            'alert_lists',
            null,
            MDB2_AUTOQUERY_SELECT,
            'author_id = ' . $this->db->quote($this->user->id, 'integer'),
            null, true, true
        );
        $lists = array();
        while ($row = $result->fetchRow()) {
            $lists[] = $this->hydrateRow($row);
        }
        return $lists;
    }

    private function findList ($author_id, $type) {
        $type = $this->validateListType($type);
        $result = $this->db->extended->autoExecute(
            'alert_lists',
            null, // SELECT queries do not need manipulation values
            MDB2_AUTOQUERY_SELECT,
            'author_id = ' . $this->db->quote($author_id, 'integer')
            . ' AND list_type = ' . $this->db->quote($type, 'text'),
            null, true, true
        );
        return $result->fetchRow();
    }

    public function findBlocklist ($id) {
        return $this->findList($id, 'block');
    }

    public function findWarnlist ($id) {
        return $this->findList($id, 'warn');
    }

    private function getUsersOnList ($list_id) {
        $result = $this->db->extended->autoExecute(
            'alerts',
            null, // SELECT queries do not need manipulation values
            MDB2_AUTOQUERY_SELECT,
            'list_id = ' . $this->db->quote($list_id, 'integer'),
            null, true, true
        );
        $users = array();
        while ($row = $result->fetchRow()) {
            $users[] = $this->hydrateRow($row); // Hydration is happiness.
        }
        return array_reverse($users);
    }

    private function hydrateRow ($row) {
        foreach ($row as $k => $v) {
            $string = (is_resource($v)) ? stream_get_contents($v) : $v;
            $json = json_decode($string);
            $row->$k = (JSON_ERROR_NONE === json_last_error()) ? $json : $string;
        }
        if (isset($row->twitter_data)) {
            $row->screen_name = $row->twitter_data->screen_name;
        }
        if (isset($row->last_modified)) {
            $row->last_modified = $this->toISOString($row->last_modified);
        }
        if (isset($row->creation_time)) {
            $row->creation_time = $this->toISOString($row->creation_time);
        }
        return $row;
    }

    private function toISOString ($str) {
        return date('c', strtotime($str));
    }

    public function getMyTwitterBlocklistID () {
        return $this->findList($this->user->id, 'twitter_blocklist')->id;
    }

    public function getMyTwitterBlocklist () {
        $list_id = $this->findList($this->user->id, 'twitter_blocklist')->id;
        return $this->getUsersOnList($list_id);
    }

    private function getLists () {
        $result = $this->db->extended->autoExecute(
            'alert_lists',
            null,
            MDB2_AUTOQUERY_SELECT,
            'list_type = ' . $this->db->quote('warn', 'text'),
            null, true, true
        );
        $lists = array();
        while ($row = $result->fetchRow()) {
            $tmp = $this->hydrateRow($row);
            $lists[$tmp->id] = $tmp;
        }
        $data = array();
        foreach ($lists as $list) {
            $list->author = $this->getListAuthor($list);
            $result = $this->db->extended->autoExecute(
                'alerts',
                null,
                MDB2_AUTOQUERY_SELECT,
                'list_id = ' . $this->db->quote($list->id, 'integer'),
                null, true, true
            );
            $alerts = array();
            while ($row = $result->fetchRow()) {
                $tmp = $this->hydrateRow($row);
                $alerts[] = $tmp;
            }
            $list->listed_users = $alerts;
            $data[] = $list;
        }
        return $data;
    }

    private function getList ($list_id) {
        $list = $this->hydrateRow($this->db->extended->autoExecute(
            'alert_lists',
            null,
            MDB2_AUTOQUERY_SELECT,
            'id = ' . $this->db->quote($list_id, 'integer'),
            null, true, true
        )->fetchRow());
        $list->author = $this->getListAuthor($list);
        return $list;
    }

    private function getListAuthor ($list) {
        return $this->hydrateRow($this->db->extended->getRow(
            'SELECT twitter_id, twitter_screen_name, twitter_data, last_modified, creation_time'
            . ' FROM users WHERE twitter_id = ' . $this->db->quote($list->author_id, 'integer')
        ));
    }

    private function addList ($params) {
        $fields = array(
            'list_type' => $this->validateListType($params['type']),
            'list_name' => $params['name'],
            'list_desc' => $params['desc'],
            'author_id' => $params['author_id']
        );
        $types = array('text', 'text', 'text', 'integer');
        $result = $this->db->extended->autoExecute(
            'alert_lists', $fields,
            MDB2_AUTOQUERY_INSERT,
            null, // Insert queries do not use a WHERE clause.
            $types
        );
        if (PEAR::isError($result)) {
            // TODO: Better error handling?
            die($result->getMessage());
        }
        return $this->db->lastInsertID('alert_lists', 'id');
    }

    private function addTwitterBlocklist ($params) {
        $params['type'] = 'twitter_blocklist';
        $params['name'] = 'Twitter Blocklist';
        $params['desc'] = 'Twitter users you are currently blocking.';
        $params['author_id'] = (empty($params['author_id'])) ? $this->user->id : $params['author_id'];
        return $this->addList($params);
    }

    // TODO: Should this even be possible?
//    private function deleteList ($list_id) {
//        if ($this->currentUserCanDeleteList($list_id)) {
//            return $this->db->extended->autoExecute(
//                'alert_lists', null,
//                MDB2_AUTOQUERY_DELETE,
//                'id = ' . $this->db->quote($list_id, 'integer')
//            );
//        }
//    }
//
//    private function currentUserCanDeleteList ($list_id) {
//        $list = $this->getList($list_id);
//        if ('twitter_blocklist' === $list->list_type) {
//            $this->template->add_notice('Twitter blocklists can not be deleted.');
//            unset($_GET['updated']);
//            return false;
//        }
//        if ($this->user->id === $list->author_id) {
//            return true;
//        } else {
//            $this->template->add_notice('You do not have sufficient privileges to do that.');
//            return false;
//        }
//    }

    private function createAlerts ($alerts, $list_id) {
        $num_inserted = 0;
        foreach ($alerts as $alert) {
            $fields = array(
                'list_id'      => $list_id,
                'twitter_id'   => $alert['twitter_id'],
                'twitter_data' => json_encode($alert['twitter_data']),
                'alerted_by'   => $alert['alerted_by'],
            );
            $types = array('integer', 'integer', 'text', 'integer');
            // TODO:
            // Currently, PostgreSQL itself ensures no user can
            // be added to the same list twice. Worth adding that
            // check here, too?
            $result = $this->db->extended->autoExecute(
                'alerts', $fields,
                MDB2_AUTOQUERY_INSERT,
                null, // Insert queries do not use a WHERE clause.
                $types
            );
            if (PEAR::isError($result) && $this->echo_debug) {
                // TODO: Do some better error handling.
                $this->template->add_notice($result->getMessage());
            } else {
                $num_inserted++;
            }
        }
        return $num_inserted;
    }

    private function addAlert ($who, $where, $data = array()) {
        $twitter_users = $this->lookupUsers($who);

        // The loop is because lookupUsers always returns an array.
        foreach ($twitter_users as $user) {
            $fields = array(
                'list_id'      => $where,
                'twitter_id'   => $user->id,
                'twitter_data' => json_encode($user),
                'alerted_by'   => $this->user->id
            );
            $types = array('integer', 'integer', 'text', 'integer');
            if ($data) {
                $fields['alert_desc'] = $data['alert_desc'];
                $types[] = 'text';
            }
            $result = $this->db->extended->autoExecute(
                'alerts', $fields,
                MDB2_AUTOQUERY_INSERT,
                null, // Insert queries do not use a WHERE clause.
                $types
            );
            if (PEAR::isError($result) && $this->echo_debug) {
                $this->template->add_notice('Problem adding an alert for ' . $user->screen_name . '. Error message: ' . $result->getMessage());
            } else {
                $num++;
            }
        }
        return $this->db->lastInsertID('alerts', 'id');
    }

    private function getTwitterTokensFor ($twitter_id) {
        $result = $this->findUser('twitter_id = ' . $this->db->quote($twitter_id, 'integer'));
        if ($row = $result->fetchRow()) {
            if (isset($row->twitter_oauth_token) && isset($row->twitter_oauth_token_secret)) {
                return array(
                    'access_token' => stream_get_contents($row->twitter_oauth_token),
                    'access_token_secret' => stream_get_contents($row->twitter_oauth_token_secret)
                );
            }
        } else {
            return false;
        }
    }

    private function talkToTwitter ($endpoint, $params, $as = array()) {
        if (empty($as)) {
            $as['access_token'] = $this->access_token;
            $as['access_token_secret'] = $this->access_token_secret;
        }
        $settings = array(
            'oauth_access_token' => $as['access_token'],
            'oauth_access_token_secret' => $as['access_token_secret'],
            'consumer_key' => $this->consumer_key,
            'consumer_secret' => $this->consumer_secret
        );
        $twitter = new TwitterAPIExchange($settings);

        $url = 'https://api.twitter.com/1.1/' . $endpoint . '.json';
        if (is_array($params)) {
            $data = $twitter->buildOauth($url, 'POST')
                            ->setPostfields($params)
                            ->performRequest();
        } else {
            $data = $twitter->setGetfield($params)
                    ->buildOauth($url, 'GET')
                    ->performRequest();
        }
        return json_decode($data);
    }

    private function verifyTwitterData ($whose = false) {
        $data = $this->talkToTwitter('account/verify_credentials', '?skip_status=true', $whose);
        if (isset($data->errors)) {
            $this->template->add_notice('An error occurred. Twitter said: ' . $data->errors[0]->message);
            return false;
        } else {
            return $data;
        }
    }

    public function login () {
        $this->client = new oauth_client_class;
        $this->client->server = 'Twitter';
        $this->client->redirect_uri =
            ((empty($_SERVER['HTTPS'])) ? 'http' : 'https')
            . '://' . $_SERVER['HTTP_HOST'] . strtok($_SERVER['REQUEST_URI'], '?')
            . '?action=login';
        $this->client->client_id = $this->consumer_key;
        $this->client->client_secret = $this->consumer_secret;

        $this->client->Initialize();

        if ($success = $this->client->Process()) {
            if (strlen($this->client->access_token)) {
                $this->access_token = $this->client->access_token;
                $this->access_token_secret = $this->client->access_token_secret;
                $this->user = $this->verifyTwitterData();
                if (!$this->user) {
                    // Something went wrong connecting to twitter, abort.
                    // TODO: Better error handling?
                    die('Could not retrieve user information from Twitter.');
                }

                // Do we have a record of this user?
                $result = $this->findUser('twitter_id = ' . $this->db->quote($this->user->id, 'integer'));
                // If not, first create a record for them.
                if (null === $result->fetchRow()) {
                    $this->makeNewUser($this->user);
                }
                // Create the user's login hash.
                // Find the preferred hashing algorithm and salt.
                if (1 === CRYPT_SHA512) {
                    $salt1 = '$6$';
                }
                if (1 === CRYPT_SHA256) {
                    $salt1 = '$6$';
                }
                $salt2 = $this->db->extended->getOne(
                    'SELECT creation_time FROM users WHERE twitter_id = '
                    . $this->db->quote($this->user->id, 'integer')
                );
                $login_hash = crypt($this->access_token . $salt2, $salt1 . 'rounds=15000$' . $this->consumer_secret . '$');

                // Save their access tokens and login hash.
                $this->db->extended->autoExecute(
                    'users',
                    array(
                        'twitter_oauth_token' => $this->access_token,
                        'twitter_oauth_token_secret' => $this->access_token_secret,
                        'login_hash' => $login_hash
                    ),
                    MDB2_AUTOQUERY_UPDATE,
                    'twitter_id = ' . $this->db->quote($this->user->id, 'integer'),
                    array('text', 'text', 'text') // SQL type hinting
                );
                // And their Twitter data.
                $this->db->extended->autoExecute(
                    'users',
                    array(
                        'twitter_data' => json_encode($this->user)
                    ),
                    MDB2_AUTOQUERY_UPDATE,
                    'twitter_id = ' . $this->db->quote($this->user->id, 'integer'),
                    array('text') // SQL type hinting
                );
                $this->resyncTwitterBlocklist($this->user->id);
                $this->setLoginCookie();
            }
        }
        $this->client->Finalize($success);

        if ($this->client->exit) {
            exit();
        }
    }

    private function setLoginCookie () {
        $expiry = time() + 3600 * 24 * 365; // Expire in 1 year.
        setcookie(
            'PAT_Twitter[twitter_id]', $this->user->id, $expiry,
            null, null, // leave path and domain at default
            ($_SERVER['HTTPS']) ? true : false, // set secure flag if this is an SSL request.
            false // Don't set HttpOnly because the userscript needs this.
        );
        setcookie(
            'PAT_Twitter[access]', $this->access_token, $expiry,
            null, null, // leave path and domain at default
            ($_SERVER['HTTPS']) ? true : false, // set secure flag if this is an SSL request.
            true // The access token is (almost) Password Equivalent, so careful.
        );
    }

    public function update ($what) {
        switch ($what) {
            case 'alert':
                $this->updateAlert($_POST['id'], array('alert_desc' => $_POST['alert_desc']));
                $_GET['what'] = 'warnlist';
                break;
        }
    }

    // TODO: Should this even be possible?
//    public function delete ($what) {
//        switch ($what) {
//            case 'list':
//                $result = $this->deleteList($_POST['id']);
//                if (PEAR::isError($result)) {
//                    $this->template->add_notice('Error deleting list: ' . $result->getMessage());
//                    unset($_GET['updated']);
//                } else {
//                    $_GET['what'] = 'pat_lists';
//                }
//                break;
//            case 'alert':
//                $this->deleteAlert($_POST['id']);
//                $_GET['what'] = 'warnlist';
//                break;
//        }
//    }

    public function create ($what) {
        extract($_POST, EXTR_SKIP); // Don't overwrite local vars.
        switch ($what) {
            case 'list':
                $params = $_POST;
                $params['type'] = 'warn';
                $params['author_id'] = $this->user->id;
                $list_id = $this->addList($params);
                // Set up next view.
                $_GET['what'] = 'list';
                $_GET['id'] = $list_id;
                break;
            case 'alert':
                if (!$data) { $data = array(); }
                $alert_id = $this->addAlert($who, $where, $data);
                $_GET['what'] = 'alert';
                $_GET['id'] = $alert_id;
                break;
        }
    }

    public function doAction ($action) {
        extract($_GET, EXTR_SKIP); // Don't overwrite local vars.
        switch ($action) {
            case 'view':
                $tpl_vars = array();
                $tpl_vars['my_twitter_blocklist_id'] = $this->findList($this->user->id, 'twitter_blocklist')->id;
                switch ($what) {
                    case 'alert':
                        $tpl_vars = $this->findAlert('id = ' . $this->db->quote($id, 'integer'));
                        if (is_resource($tpl_vars->twitter_data)) {
                            $tpl_vars->twitter_data = json_decode(stream_get_contents($tpl_vars->twitter_data));
                        }
                        if (is_resource($tpl_vars->alert_desc)) {
                            $tpl_vars->alert_desc = stream_get_contents($tpl_vars->alert_desc);
                        }
                        break;
                    case 'list':
                        $tpl_vars['list_info'] = $this->getList($_GET['id']);
                        $tpl_vars['listed_users'] = $this->getUsersOnList($_GET['id']);
                        break;
                    case 'pat_lists':
                        $tpl_vars['lists'] = $this->getLists();
                        break;
                }
                if ('application/json' === $_SERVER['HTTP_ACCEPT']) {
                    header('Content-Type: application/json');
                    print json_encode($tpl_vars);
                    exit();
                } else if ('export' === $_REQUEST['do']) {
                    header('Content-Type: application/json');
                    header('Content-Disposition: attachment; filename=PAT-List-' . urlencode($tpl_vars['list_info']->list_name) . '.json');
                    // Construct expected JSON object.
                    unset($tpl_vars['my_twitter_blocklist_id']);
                    $tpl_vars['local_key'] = $tpl_vars['list_info']->list_name . '_' . $tpl_vars['list_info']->author->twitter_id;
                    $tpl_vars['data'] = $tpl_vars['list_info'];
                    unset($tpl_vars['list_info']);
                    $tpl_vars['data']->visibility = 'public';
                    $horcrux = new stdClass();
                    $horcrux->server_url = $this->template->site_url('/');
                    $horcrux->list_name = $tpl_vars['data']->list_name;
                    $horcrux->id = $_GET['id'];
                    $tpl_vars['data']->horcruxes = array($horcrux);
                    $tmp = new stdClass();
                    foreach ($tpl_vars['listed_users'] as $user) {
                        $twitter_id = $user->twitter_id;
                        $tmp->$twitter_id = $user;
                    }
                    unset($tpl_vars['listed_users']);
                    $tpl_vars['listed_users'] = $tmp;
                    print json_encode($tpl_vars);
                    exit();
                } else {
                    if (isset($_GET['updated'])) {
                        $this->template->add_notice('Changes saved.');
                    }
                    $this->template->add_content($this->template->load_view($what, $tpl_vars));
                }
                break;
            case 'download':
                // TODO: Refactor this download thing.
                if ('userscript' === $what || 'userscript.user.js' === $what) {
                    if (preg_match('/\.user\.js$/', $_SERVER['REQUEST_URI'])) {
                        $raw_script_src = file_get_contents(dirname(__FILE__) . '/userscript/predator-alert-tool-for-twitter.user.js');
                        // Modify the script resource at delivery time.
                        // This makes sure that people who download this script form this
                        // installation will be querying this installation for their own data.
                        $script_src = str_replace(
                            '__PAT_TWITTER_CLIENT_HOME_URL__',
                            $this->template->site_url('/'),
                            $raw_script_src
                        );
                        $script_src = str_replace(
                            '__PAT_TWITTER_CLIENT_NAMESPACE__',
                            implode('.', array_reverse(explode('.', $_SERVER['HTTP_HOST']))),
                            $script_src
                        );
                        $script_src = str_replace(
                            '__PAT_TWITTER_CLIENT_INCLUDE_URL__',
                            $this->template->site_url() . '/lib/pat-twitter/userscript',
                            $script_src
                        );
                        header('Content-Type: application/javascript');
                        print $script_src;
                    } else {
                        header('Location: ' . $this->template->site_url('/') . '?action=download&what=userscript.user.js');
                    }
                    exit();
                }
                break;
            case 'logout':
            default:
                $valid_actions = array(
                    'logout',
                    'view',
                    'download'
                );
                if (in_array($action, $valid_actions)) {
                    $this->$action();
                }
                break;
        }
    }

    public function subscribe ($what) {
        extract($_POST, EXTR_SKIP); // Don't overwrite local vars.
        switch ($what) {
            case 'block':
            default:
                // Update the other user's blocklist.
                $this->resyncTwitterBlocklist($who);
                $they_blocked = $this->getUsersOnList($this->findList($who, 'twitter_blocklist')->id);
                $they_blocked_ids = array();
                foreach ($they_blocked as $x) {
                    $they_blocked_ids[] = $x->twitter_id;
                }
                // Update the current user's blocklist.
                $this->resyncTwitterBlocklist($this->user->id);
                $i_blocked = $this->getUsersOnList($this->getMyTwitterBlocklistID());
                $i_blocked_ids = array();
                foreach ($i_blocked as $x) {
                    $i_blocked_ids[] = $x->twitter_id;
                }
                // Block all the users on the other user's blocklist not already blocked.
                $num_blocked = 0;
                foreach (array_diff($they_blocked_ids, $i_blocked_ids) as $usr_id) {
                    $data = $this->blockUser($usr_id);
                    if (isset($data->errors) && $this->echo_debug) {
                        $this->template->add_notice($data->erorrs[0]->message);
                    } else {
                        $num_blocked++;
                    }
                }
                $this->template->add_notice("You blocked $num_blocked users.");
                $_GET['what'] = 'list';
                $_GET['id'] = $this->getMyTwitterBlocklistID();
                break;
        }
    }

    private function blockUser ($twitter_id) {
        return $this->talkToTwitter('blocks/create', array('user_id' => $twitter_id, 'skip_status' => true));
    }

    public function logout () {
        foreach ($_COOKIE['PAT_Twitter'] as $cookie_name => $cookie_value) {
            setcookie(
                "PAT_Twitter[$cookie_name]", '', strtotime('1970-01-02'), // Delete by setting to past date.
                null, null, // leave path and domain at default
                ($_SERVER['HTTPS']) ? true : false, // set secure flag if this is an SSL request.
                true // set HttpOnly because why not?
            );
        }
        session_destroy();
        setcookie('PHPSESSID', false, strtotime('1970-01-02'));
        $url = ($_SERVER['HTTPS']) ? 'https' : 'http';
        $url .= '://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
        header('Location: ' . str_replace('action=logout', 'action=loggedout', $url));
        exit();
    }

    private function makeNewUser ($usr) {
        $this->addUser($usr);
        // Create a twitter blocklist for the new user to represent who they block.
        $list_id = $this->addTwitterBlocklist(array('author_id' => $usr->id));
    }

    private function addUser ($usr) {
        $fields = array(
            'twitter_id' => $usr->id,
            'twitter_screen_name' => $usr->screen_name,
            'twitter_data' => json_encode($usr)
            // we can leave "last modified" at database default
        );
        $types = array('integer', 'text', 'text');
        // Create user record.
        $result = $this->db->extended->autoExecute(
            'users', $fields,
            MDB2_AUTOQUERY_INSERT,
            null, // Insert queries do not use a WHERE clause.
            $types
        );
        if (PEAR::isError($result)) {
            // TODO: Better error handling?
            die($result->getMessage());
        }
    }

}
