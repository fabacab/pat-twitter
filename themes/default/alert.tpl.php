<form action="<?php $tpl->print_html($_SERVER['REQUEST_URI']);?>&amp;updated" method="POST">
    <input type="hidden" name="do" value="update" />
    <input type="hidden" name="what" value="alert" />
    <input type="hidden" name="id" value="<?php $tpl->print_html($tpl_vars->id);?>" />
    <p><label for="textarea">Alert description: <span class="helptext">Provide a reason why you're alerting others to this user.</span></label></p>
    <p><textarea id="textarea" name="alert_desc"><?php $tpl->print_html($tpl_vars->alert_desc);?></textarea></p>
    <p><input type="submit" value="Submit" /></p>
</form>
