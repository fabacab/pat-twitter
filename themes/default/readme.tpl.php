<?php
$parsedown = new Parsedown();
print $parsedown->text(file_get_contents('README.markdown'));
?>
