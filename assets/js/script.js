$(function(){
    var sections = {};

    // Grab positions of our sections 
    $('.anchor').each(function(){
        sections[this.name] = $(this).offset().top;
    });

    $(document).scroll(function(){
        var pos = $(this).scrollTop();
        var height = $(window).height();

        // Look in the sections object and see if any section is viewable on the screen. 
        // If two are viewable, the lower one will be the active one. 
        $('a').removeClass('active');
        for(var i in sections) {
            if(sections[i] > pos && sections[i] < pos + height){
            	//$('a').removeClass('active');
                $('#nav_' + i).addClass('active');
            }  
        }
    });
});
