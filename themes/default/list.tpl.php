<h2><?php $tpl->print_html($tpl_vars['list_info']->list_name);?></h2>
<p><?php $tpl->print_html($tpl_vars['list_info']->list_desc);?></p>
<ul class="actions visuallyhidden">
    <li>
        <button
            id="pat-twitter-list-subscribe-button"
            data-list-name="<?php $tpl->print_html($tpl_vars['list_info']->list_name);?>"
            data-list-id="<?php $tpl->print_html($tpl_vars['list_info']->id);?>">Add to my PAT Twitter Lists.</button>
    </li>
</ul>
<form action="<?php $tpl->print_html($_SERVER['REQUEST_URI']);?>&amp;updated" method="POST">
    <input type="hidden" name="what" value="list" />
    <input type="hidden" name="id" value="<?php $tpl->print_html($tpl_vars['list_info']->id);?>" />
    <ul class="actions">
        <?php if ('twitter_blocklist' === $tpl_vars['list_info']->list_type) { ?>
            <li><button name="do" value="resync">Resync with Twitter</button></li>
        <?php } ?>
        <li><button name="do" value="export">Export</button></li>
    </ul>
</form>
<?php
if ($tpl_vars['listed_users']) {
?>
<ul>
    <?php foreach ($tpl_vars['listed_users'] as $user) : ?>
    <li>
        <a href="https://twitter.com/<?php $tpl->print_html($user->screen_name);?>">@<?php $tpl->print_html($user->screen_name);?> ("<?php $tpl->print_html($user->twitter_data->name);?>")</a>
        Alert:
        <p><?php $tpl->print_html($user->alert_desc);?></p>
    </li>
    <?php endforeach;?>
</ul>
</form>
<?php } else { ?>
<p>This list is empty.</p>
<?php } ?>
