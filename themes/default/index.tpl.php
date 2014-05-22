<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>Predator Alert Tool for Twitter</title>
    <meta name="generator" content="Predator Alert Tool for Twitter version <?php $tpl->print_html($PAT_Twitter->getVersion());?>" />
    <link rel="stylesheet" href="<?php $tpl->print_html($tpl->theme_url('style.css'));?>" type="text/css" />
</head>
<body>
    <header>
        <?php $tpl->print_notices();?>
    </header>
<?php
if ($PAT_Twitter->getCurrentUser()) {
    $tpl->load_template('home');
} else {
    $tpl->load_template('login');
}
?>
<footer id="server-meta">
    <p>I am the <?php $tpl->print_html($_SERVER['HTTP_HOST']);?> facilitation server.</p>
</footer>
<hr />
<section id="readme"><?php print $tpl->load_view('readme');?></section>
</body>
</html>
