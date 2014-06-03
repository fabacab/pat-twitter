<?php
$me = $PAT_Twitter->getCurrentUser();
$my_twitter_blocklist_id = $PAT_Twitter->getMyTwitterBlocklistID();
?>
<h1>Predator Alert Tool for Twitter</h1>
<p>Hello, <?php $tpl->print_html($me->name);?>. (<a href="<?php $tpl->print_html($tpl->loginout_url());?>">Logout</a>)</p>
<p>Some things you can do:</p>
<ul class="actions">
    <li><a href="?action=view&amp;what=list&amp;id=<?php $tpl->print_html($my_twitter_blocklist_id);?>">View my Twitter blocklist.</a></li>
    <li><a href="?action=view&amp;what=following">Block users your friends are blocking.</a></li>
    <li><a href="?action=view&amp;what=pat_lists">Browse Predator Alert Tool for Twitter Lists.</a></li>
    <li><a href="?action=view&amp;what=download-userscript#installation-instructions">Download and install in your browser.</a></li>
</ul>
<?php $tpl->render_view();?>
