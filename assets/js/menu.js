$(function() {
    var nav = $('#nav');
    var anchors = $('.anchor');
    var goHome = $('.home');
    var navHomeY = nav.offset().top;
    var isFixed = false;
    var $w = $(window);
    $w.scroll(function() {
        var scrollTop = $w.scrollTop();
        var shouldBeFixed = scrollTop > navHomeY;
        if (shouldBeFixed && !isFixed) {
            nav.css({
                position: 'fixed',
                top: 0,
                left: nav.offset().left,
                width: nav.width()
            });
            anchors.css({
                display: 'block',
                position: 'relative',
                top: '-62px',
                visibility: 'hidden'
            });
            goHome.css({
                visibility: 'visible'
            })
            nav.addClass('top');
            isFixed = true;
        }
        else if (!shouldBeFixed && isFixed)
        {
            nav.css({
                position: 'static'
            });
            anchors.css({
                display: 'block',
                position: 'relative',
                top: '-100px',
                visibility: 'hidden'
            });
            nav.removeClass('top');
            goHome.css({
                visibility: 'hidden'
            })
            isFixed = false;
        }
    });
});