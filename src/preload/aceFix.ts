window.onload = () => {
    if (document.getElementsByClassName('ace_editor').length != 0) {
        window.onkeyup = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.keyCode == 86) {
                document.execCommand('paste');
            } else if (e.ctrlKey && e.keyCode == 65) {
                document.execCommand('selectAll');
            }
        };
    }
};
