/**
 * Draggable UI Module
 * Generic drag-and-drop functionality for SVG elements
 */

/**
 * Load saved position from localStorage
 * @param {SVGElement} element - SVG element to position
 * @param {string} storageKey - localStorage key
 */
function loadSavedPosition(element, storageKey) {
    if (!element) return;

    const savedPosition = localStorage.getItem(storageKey);
    if (savedPosition) {
        const position = JSON.parse(savedPosition);
        const currentTransform = element.getAttribute('transform') || '';
        const scaleMatch = currentTransform.match(/scale\([^)]+\)/);
        const rotateMatch = currentTransform.match(/rotate\([^)]+\)/);

        let newTransform = `translate(${position.x}, ${position.y})`;
        if (scaleMatch) newTransform += ` ${scaleMatch[0]}`;
        if (rotateMatch) newTransform += ` ${rotateMatch[0]}`;

        element.setAttribute('transform', newTransform);
    }
}

/**
 * Create draggable behavior for an SVG element
 * @param {SVGElement} element - Element to make draggable
 * @param {Object} options - Configuration options
 * @param {string} options.storageKey - Key for saving position to localStorage
 * @param {string} options.excludeSelector - CSS selector for elements that shouldn't trigger drag
 * @param {string} options.cursor - Default cursor style
 * @param {string} options.activeCursor - Cursor style when dragging
 * @param {Function} options.onStart - Callback when drag starts
 * @param {Function} options.onMove - Callback during drag
 * @param {Function} options.onEnd - Callback when drag ends
 * @param {Function} options.customSave - Custom save function
 */
function createDraggable(element, options = {}) {
    const {
        storageKey,
        excludeSelector = null,
        cursor = 'move',
        activeCursor = null,
        onStart = null,
        onMove = null,
        onEnd = null,
        customSave = null
    } = options;

    let isDragging = false;
    let startX, startY, currentTransform;

    // Set default cursor
    if (typeof cursor === 'string') {
        element.style.cursor = cursor;
    }

    function handleStart(e) {
        // Skip if clicking on excluded elements
        if (excludeSelector && e.target.closest(excludeSelector)) {
            return;
        }

        // Call custom onStart if provided (can return false to cancel)
        if (onStart && onStart(e) === false) {
            return;
        }

        isDragging = true;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        startX = clientX;
        startY = clientY;

        const transform = element.getAttribute('transform') || '';
        const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
        currentTransform = {
            x: match ? parseFloat(match[1]) : 0,
            y: match ? parseFloat(match[2]) : 0,
            scale: transform.match(/scale\([^)]+\)/)?.[0] || '',
            rotate: transform.match(/rotate\([^)]+\)/)?.[0] || ''
        };

        element.style.opacity = '0.7';
        if (activeCursor) {
            element.style.cursor = activeCursor;
        }

        e.preventDefault();
        e.stopPropagation();
    }

    function handleMove(e) {
        if (!isDragging) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const dx = clientX - startX;
        const dy = clientY - startY;

        // Call custom onMove if provided
        if (onMove) {
            onMove({ dx, dy, clientX, clientY, startX, startY, currentTransform, element });
        } else {
            // Default behavior: update position while preserving scale/rotate
            const newX = currentTransform.x + dx;
            const newY = currentTransform.y + dy;
            let newTransform = `translate(${newX}, ${newY})`;
            if (currentTransform.scale) newTransform += ` ${currentTransform.scale}`;
            if (currentTransform.rotate) newTransform += ` ${currentTransform.rotate}`;
            element.setAttribute('transform', newTransform);
        }
    }

    function handleEnd(e) {
        if (!isDragging) return;
        isDragging = false;

        element.style.opacity = '1';
        if (activeCursor) {
            element.style.cursor = cursor;
        }

        // Call custom onEnd or save if provided
        if (onEnd) {
            onEnd(e, element);
        } else if (customSave) {
            customSave(element);
        } else if (storageKey) {
            // Default save behavior
            const transform = element.getAttribute('transform');
            const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
            if (match) {
                const position = {
                    x: parseFloat(match[1]),
                    y: parseFloat(match[2])
                };
                localStorage.setItem(storageKey, JSON.stringify(position));
            }
        }
    }

    // Add event listeners
    element.addEventListener('mousedown', handleStart);
    element.addEventListener('touchstart', handleStart, { passive: false });

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('touchmove', handleMove, { passive: false });

    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchend', handleEnd);

    // Return cleanup function
    return function cleanup() {
        element.removeEventListener('mousedown', handleStart);
        element.removeEventListener('touchstart', handleStart);
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchend', handleEnd);
    };
}

/**
 * Extract position from transform attribute
 * @param {SVGElement} element - Element to get position from
 * @returns {Object} - Position object with x, y
 */
function getPositionFromTransform(element) {
    const transform = element.getAttribute('transform') || '';
    const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
    return {
        x: match ? parseFloat(match[1]) : 0,
        y: match ? parseFloat(match[2]) : 0
    };
}

/**
 * Set position on element while preserving other transforms
 * @param {SVGElement} element - Element to position
 * @param {number} x - X position
 * @param {number} y - Y position
 */
function setPosition(element, x, y) {
    const transform = element.getAttribute('transform') || '';
    const scaleMatch = transform.match(/scale\([^)]+\)/);
    const rotateMatch = transform.match(/rotate\([^)]+\)/);

    let newTransform = `translate(${x}, ${y})`;
    if (scaleMatch) newTransform += ` ${scaleMatch[0]}`;
    if (rotateMatch) newTransform += ` ${rotateMatch[0]}`;

    element.setAttribute('transform', newTransform);
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadSavedPosition,
        createDraggable,
        getPositionFromTransform,
        setPosition
    };
}
