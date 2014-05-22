<form action="<?php $tpl->print_html($_SERVER['REQUEST_URI'])?>" method="POST">
<input type="hidden" name="do" value="subscribe" />
<input type="hidden" name="what" value="list" />
<ul>
    <?php foreach ($tpl_vars['lists'] as $list) { ?>
    <li>
        <a href="?action=view&amp;what=list&amp;id=<?php $tpl->print_html($list->id);?>"><?php $tpl->print_html($list->list_name);?></a>
        by <a href="https://twitter.com/<?php $this->print_html($list->author->twitter_screen_name);?>">@<?php $tpl->print_html($list->author->twitter_screen_name);?></a>
    </li>
    <?php } ?>
</ul>
</form>
