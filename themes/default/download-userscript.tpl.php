<?php
$parsedown = new Parsedown();
?>
<section>
    <h2 id="installation-instructions">Installation instructions</h2>
    <?php print $parsedown->text(file_get_contents('docs/Browser-requirements.md'));?>
    <h3 id="install-predator-alert-tool-for-twitter">Install Predator Alert Tool for Twitter</h3>
    <p>Once you've set up your Web browser correctly (see above), you can install Predator Alert Tool for Twitter by clicking the link below:</p>
    <p style="font-weight:bold;font-size: x-large;"><a href="<?php $tpl->print_html($tpl->site_url());?>/predator-alert-tool-for-twitter.user.js" id="download-userscript">Click here to download and install Predator Alert Tool for Twitter in your browser.</a></strong></p>
    <p>After you've installed Predator Alert Tool for Twitter:</p>
    <ul>
        <li><a href="?action=view&amp;what=pat_lists">Subscribe to Predator Alert warnlists available on this server</a> so you get notified of predatory users while browsing Twitter.</li>
        <li><a href="?action=view&amp;what=following">Invite your Twitter friends to use Predator Alert Tool for Twitter so you can share information with them about dangerous or abusive Twitter users</a>.</li>
        <li><a href="https://twitter.com/<?php $me = $PAT_Twitter->getCurrentUser(); $tpl->print_html($me->screen_name);?>/lists">Create a new warnlist to document harassment or bullying you've endured on Twitter.</a></li>
    </ul>
</section>
