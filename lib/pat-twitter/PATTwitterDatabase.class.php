<?php
class PAT_Twitter_Database {
    private $driver;

    public function __construct ($database_url) {
        // Load depedencies.
        $old_path = set_include_path(get_include_path() . PATH_SEPARATOR . dirname(dirname(__FILE__)) . '/pear');
        require_once('MDB2.php');

        $this->connect($database_url);

        // What's our database like?
        $this->driver->loadModule('Manager');
        $db_tables = $this->driver->listTables();
        if (PEAR::isError($db_tables)) {
            die('Error establishing database connection. Double check your DATABASE_URL?');
        }
        // If the database is empty, run the initialization SQL.
        if (empty($db_tables)) {
            $sql = file_get_contents(dirname(__FILE__) . "/create_tables.{$this->driver->phptype}.sql");
            $this->driver->exec($sql);
        }
        $this->driver->setFetchMode(MDB2_FETCHMODE_OBJECT);
    }

    private function connect ($dsn_url) {
        $parts = parse_url($dsn_url);
        $dsn = array(
            'phptype' => ('postgres' === $parts['scheme']) ? 'pgsql' : $parts['scheme'],
            'username' => $parts['user'],
            'password' => (isset($parts['pass'])) ? $parts['pass'] : false,
            'hostspec' => $parts['host'],
            'database' => substr($parts['path'], 1)
        );

        $this->driver = & MDB2::singleton($dsn); // By reference, please.
        $this->driver->loadModule('Extended', null, false); // Give me autoPrepare()!
    }

    public function getDriver () {
        return $this->driver;
    }
}
