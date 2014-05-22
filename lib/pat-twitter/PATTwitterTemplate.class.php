<?php
/**
 * Predator Alert Tool for Twitter template functions.
 */

require_once(dirname(__FILE__) . '/Parsedown/Parsedown.php');

class PAT_Twitter_Template {
    private $request_base; //< The base URL of the initiating request.
    private $filesys_base;
    private $theme_name;
    private $notices = array();
    private $views = array(); // Queue up HTML content to render.

    public function __construct ($template_path = './') {
        if (!is_readable($template_path)) {
            die('Error: The theme folder either does not exist or is not readable.');
        }
        $this->filesys_base = $template_path . '/';
        $this->theme_name = basename($this->filesys_base);
        $this->request_base = dirname($_SERVER['PHP_SELF']);
    }

    private function getTemplatePath ($str) {
        return "{$this->filesys_base}{$this->tpl_dir}$str.tpl.php";
    }

    private function load_template ($tpl_name, $tpl_vars = array()) {
        // Move variables to local scope.
        global $PAT_Twitter;
        $tpl = $this;
        if (is_readable($this->getTemplatePath($tpl_name))) {
            include($this->getTemplatePath($tpl_name));
        } else {
            $this->add_notice('Could not load view: ' . $tpl_name);
            return false;
        }
    }

    // Same as load_template() but returns instead of outputs the content.
    public function load_view ($view_name, $tpl_vars = array()) {
        ob_start();
        $this->load_template($view_name, $tpl_vars);
        $str = ob_get_contents();
        ob_end_clean();
        return $str;
    }

    public function site_url () {
        $is_ssl_frontend = false;
        if ($_SERVER['HTTPS'] || 'https' === $_SERVER['HTTP_X_FORWARDED_PROTO']) {
            $is_ssl_frontend = true;
        }
        $url = ($is_ssl_frontend) ? 'https' : 'http';
        $url .= '://' . $_SERVER['HTTP_HOST'] . $this->request_base;
        return $url;
    }

    public function theme_url ($str) {
        $dir = '';
        if ('/' !== $this->request_base) {
            $dir = '/';
        }
        return "{$this->request_base}{$dir}themes/{$this->theme_name}/$str";
    }

    public function loginout_url () {
        global $PAT_Twitter;
        $str = '?action=';
        if ($PAT_Twitter->getCurrentUser()) {
            $str .= 'logout';
        } else {
            $str .= 'login';
        }
        return $str;
    }

    public function add_content ($content) {
        $this->views[] = $content;

    }

    public function render_view ($key = false) {
        if (false === $key) {
            foreach ($this->views as $k => $html) {
                print $html;
            }
        } else {
            print $this->views[$key];
        }
    }

    public function add_notice ($msg) {
        $this->notices[] = $msg;
    }

    public function print_notices () {
        if (empty($this->notices)) { return; }
        print '<div class="notices"><ul>';
        foreach ($this->notices as $notice) {
            print '<li>' . $this->esc_html($notice) . '</li>';
        }
        print '</ul></div>';
    }

    // TODO: Improve this.
    // Poor man's output escaping.
    public function print_html ($html) {
        print $this->esc_html($html);
    }
    public function esc_html ($html) {
        return htmlentities($html, ENT_QUOTES, 'UTF-8');
    }

    public function render () {
        $this->load_template('index');
    }
}
