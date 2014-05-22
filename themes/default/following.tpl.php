<p>You are currently following:</p>
<form action="<?php $this->print_html($_SERVER['REQUEST_URI']);?>" method="POST">
<input type="hidden" name="do" value="subscribe" />
<input type="hidden" name="what" value="block" />
<ul>
    <?php foreach ($PAT_Twitter->getFollowing() as $friend) : ?>
    <li>
        <a href="https://twitter.com/<?php $tpl->print_html($friend->screen_name);?>">@<?php $tpl->print_html($friend->screen_name);?> ("<?php $tpl->print_html($friend->name);?>")</a>
        <ul class="actions">
            <?php if ($friend->pat_twitter_enabled) : ?>
            <li><button name="who" value="<?php $tpl->print_html($friend->id);?>">Block everyone @<?php $tpl->print_html($friend->screen_name);?> blocks.</button></li>
            <?php else:?>
            <li><a href="https://twitter.com/intent/tweet/?text=%40<?php $tpl->print_html($friend->screen_name);?>%20If%20you%20use%20this%20app%20it%20will%20let%20me%20block%20Twitter%20users%20you've%20blocked.%20Add%20it%20for%20me%3F%20<?php print urlencode($tpl->site_url());?>">Invite @<?php $tpl->print_html($friend->screen_name);?> to share their blocklist.</a></li>
            <?php endif;?>
        </ul>
    </li>
    <?php endforeach;?>
</ul>
</form>
