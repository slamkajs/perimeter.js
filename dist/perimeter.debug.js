/*
 *  Project: Perimeter.js
 *  Creates an invisible perimeter around a target element and monitors mouse breaches.
 *  When a breach is detected the corresponding callback will be invoked.
 *  This gives the opportunity to e.g. lazy-load scripts, show a tooltip or whatnot.
 *
 *  @author  : Boye Oomens <github@e-sites.nl>
 *  @version : 0.3.0
 *  @license : MIT
 *  @see     : http://github.e-sites.nl/perimeter.js/
 */

(function (window, document, undefined) {

    'use strict';

    var win = window,
        doc = document,
        docElem = doc.documentElement,
        docBody = doc.body,
        instances = [];

    /**
     * Cross Browser helper for addEventListener.
     *
     * @param {HTMLElement} obj The Element to attach event to.
     * @param {String} evt The event that will trigger the binded function.
     * @param {Function(event)} fn The function to bind to the element.
     * @return {Boolean} true if it was successfuly binded.
     * @private
     */
    function _addEventListener(obj, evt, fn) {
        // W3C model
        if ( obj.addEventListener ) {
            obj.addEventListener(evt, fn, false);
            return true;
        }
        // Microsoft model
        else if ( obj.attachEvent ) {
            return obj.attachEvent('on' + evt, fn);
        }
        return false;
    }

    /**
     * Global Perimeter constructor
     *
     * @param {Object} options
     * @constructor
     */
    function Perimeter(options) {

        // We need at least a target element and an outline to work with
        if ( !options || !options.target || !options.outline ) {
            return;
        }

        // Called as function
        if ( !(this instanceof Perimeter) ) {
            return new Perimeter(options);
        }

        /**
         * Perimeter options
         *
         * @type {Object}
         */
        this.options = options;

        /**
         * The amount of perimeter breaches
         *
         * @type {Array}
         */
        this.breaches = [];

        /**
         * Whether the perimeter has been breached
         *
         * @type {Boolean}
         */
        this.alarm = false;

        /**
         * Outline around the target element
         * This can either be an array with top/right/bottom/left dimensions
         * or just one number which acts as shorthand for all directions
         *
         * @type {Number|Array}
         */
        this.outline = this.formatOutline(options.outline);

        /**
         * Target element
         *
         * @type {Object}
         */
        this.target = (typeof options.target === 'string' ? doc.getElementById(options.target) : options.target);

        /**
         * Boundary used for debugging purposes
         * @type {Object}
         */
        this.boundary = null;

        /**
         * Bounding rectangles
         *
         * @type {Object} ClientRect
         */
        this.rects = this.getClientRect(this.target);

        /**
         * Breach monitor
         * @type {Monitor}
         */
        this.monitor = new this.Monitor(this);

        return this.init(options);
    }

    /**
     * Small helper to fetch cross-browser scroll values
     *
     * @return {Object} top and left scroll pos
     */
    Perimeter.prototype.getScrollPos = function () {
        return {
            top: docElem.scrollTop || docBody.scrollTop,
            left: docElem.scrollLeft || docBody.scrollLeft
        };
    };

    /**
     * Returns the given element dimensions and offset
     * based on getBoundingClientRect including document scroll offset
     *
     * @param {HTMLElement} elem target element
     * @return {Object}
     */
    Perimeter.prototype.getClientRect = function (elem) {
        var scrollPos = this.getScrollPos(),
            box;

        if ( typeof elem.getBoundingClientRect === 'undefined' ) {
            throw new Error('Perimeter.js detected that your browser does not support getBoundingClientRect');
        }

        box = elem.getBoundingClientRect();

        return {
            width: box.width || elem.offsetWidth,
            height: box.height || elem.offsetHeight,
            top: (box.top + scrollPos.top - docElem.clientTop),
            left: (box.left + scrollPos.left - docElem.clientLeft)
        };
    };

    /**
     * When triggered via onresize it will recalculate the clientRect and reflow all existing boundaries
     */
    Perimeter.prototype.recalculate = function () {
        var inst, i;
        if ( this instanceof Perimeter ) {
            this.outline = this.formatOutline( this.outline );
            if ( this.options.debug && this.boundary ) {
                this.boundary.reflow();
            }
        } else {
            i = instances.length;
            while (i--) {
                inst = instances[i];
                inst.rects = inst.getClientRect( inst.target );
                if ( inst.options.debug && inst.boundary ) {
                    inst.boundary.reflow();
                }
            }
        }
    };

    /**
     * Triggers the corresponding callback of the given event type

     * @param {String} event event type
     * @param {Object} eData event data
     * @return {Boolean}
     */
    Perimeter.prototype.trigger = function (event, eData) {
        if(!eData) {
            eData = typeof undefined;
        }

        var events = {
            'breach': this.options.onBreach,
            'leave': this.options.onLeave
        };

        if ( events.hasOwnProperty(event) && (events[event] instanceof Function) ) {
            events[event].apply(this, [eData]);
        }
    };

    /**
     * Formats the given outline, this can either be a number or an array with numbers
     * When the numbers are passed as string they will be converted to numbers
     * Also,
     *
     * @param  {Array|Number} outline
     * @return {Array}
     */
    Perimeter.prototype.formatOutline = function (outline) {
        var arr = [],
            i = 0;

        while (i < 4) {
            if ( !isNaN(outline) ) {
                arr.push( parseInt(outline, 10) );
            } else {
                arr.push( (!outline[i] ? 0 : parseInt(outline[i], 10)) );
            }
            i++;
        }

        return arr;
    };

    /**
     * Main init method that kickstarts everything
     *
     * @param {Object} options Perimeter options
     */
    Perimeter.prototype.init = function (options) {
        // Cancel the process when the target DOM element is not present
        if ( !this.target ) {
            return;
        }

        // Keep track of all instances
        instances.push( this );

        // Create and show boundary when debug option is passed
        if ( options.debug && typeof this.Boundary !== 'undefined' ) {
            this.boundary = new this.Boundary( this );
        }

        _addEventListener( options.monitor || doc, 'mousemove', this.monitor.observe );
        _addEventListener( win, 'resize', this.recalculate );

        // Due to different browser behavior when it comes to triggering the mousemove event
        // while scrolling using the mousehweel, we need to listen to this event as well
        _addEventListener( doc, 'DOMMouseScroll', this.monitor.observe );
        _addEventListener( doc, 'mousewheel', this.monitor.observe );
    };

    // Expose Perimeter to global scope
    win.Perimeter = Perimeter;

}(window, window.document));


/**
 * Monitor that observes the given element and detects mouse breaches
 *
 * @param {Object} perimeter Perimeter instance
 * @return {Object}
 * @constructor
 */

/* global Perimeter */

(function (Perimeter, window) {

    'use strict';

    Perimeter.prototype.Monitor = function (perimeter) {

        var monitor = this;

        /**
         * Reference to the event object
         *
         * @type {Object}
         */
        this.event = null;

        /**
         * Detects a breach and when the cursor leaves the perimeter
         *
         * @param {String} state either breach or leave
         */
        this.detect = function (state) {
            var	outline = perimeter.outline,
                target = perimeter.target,
                posX = this.event.clientX,
                posY = this.event.clientY,
                scrollPos = perimeter.getScrollPos(),
                maxTop = parseInt((target.offsetTop - scrollPos.top - outline[0]), 10),
                maxLeft = parseInt((target.offsetLeft - scrollPos.left - outline[3]), 10);

            switch (state) {
            case 'breach':
                if (
                    posY >= maxTop &&
                    posY < ((maxTop + perimeter.rects.height) + (outline[0] + outline[2])) &&
                    posX >= maxLeft &&
                    posX < ((maxLeft + perimeter.rects.width) + (outline[1] + outline[3]))
                ) {
                    perimeter.breaches.push([posX, posY]);
                    perimeter.trigger('breach', this.event);
                    perimeter.alarm = true;
                }
                break;
            case 'leave':
                if (
                    posY < maxTop ||
                    posY > (maxTop + perimeter.rects.height + (outline[0] + outline[2])) ||
                    posX < maxLeft ||
                    posX > (maxLeft + perimeter.rects.width + (outline[1] + outline[3]))
                ) {
                    perimeter.trigger('leave');
                    perimeter.alarm = false;
                }
                break;
            }
        };

        /**
         * Main observer that invokes the detection
         *
         * @param {Object} e Event object
         */
        this.observe = function (e) {
            monitor.event = e || window.event;
            perimeter.monitor.detect( perimeter.alarm ? 'leave' : 'breach' );
        };

        return this.event;
    };

}(Perimeter, window));


/**
 * Boundary constructor
 *
 * @param  {Object} Perimeter object
 * @return {Object} Boundary object
 * @constructor
 */

/* global Perimeter */

(function (Perimeter, doc) {

	'use strict';

	Perimeter.prototype.Boundary = function (perimeter) {

		/**
		 * Boundary division element
		 * 
		 * @type {HTMLDivElement}
		 */
		this.elem = null;

		/**
		 * Recalculates rectangle offset and dimensions based on new outline
		 * 
		 * @return {Object} newRect
		 * @private
		 */
		function _recalculateRect(target, outline) {
			var rects = perimeter.rects || perimeter.getClientRect( target ),
				newRect = {};

			newRect.width = rects.width + (outline[1] + outline[3]);
			newRect.height = rects.height + (outline[0] + outline[2]);
			newRect.top = (rects.top - outline[0]);
			newRect.left = (rects.left - outline[3]);

			return newRect;
		}

		/**
		 * Creates the division and injects it into the DOM
		 * 
		 * @return {Object}
		 */
		this.create = function () {
			this.elem = doc.createElement('div');
			this.elem.className = 'boundary';

			this.reflow( perimeter.target, perimeter.outline );

			doc.body.appendChild( this.elem );

			return this;
		};

		/**
		 * Repositions the boundary element
		 * 
		 * @param  {Object} target
		 * @param  {Number} outline
		 * @return {Object}
		 */
		this.reflow = function (target, outline) {
			var box = target || perimeter.target,
				rect;

			outline = perimeter.formatOutline( outline || perimeter.outline );
			rect = _recalculateRect( box, outline );

			this.elem.style.top = rect.top + 'px';
			this.elem.style.left = rect.left + 'px';
			this.elem.style.width = rect.width + 'px';
			this.elem.style.height = rect.height + 'px';

			return this;
		};

		return this.create();
	};

}(Perimeter, document));