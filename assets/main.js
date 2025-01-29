/**
 * Adds an observer to initialise a script when an element is scrolled into view.
 * @param {Element} element - Element to observe.
 * @param {Function} callback - Function to call when element is scrolled into view.
 * @param {number} [threshold=500] - Distance from viewport (in pixels) to trigger init.
 */
function initLazyScript(element, callback, threshold = 500) {
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (typeof callback === 'function') {
            callback();
            observer.unobserve(entry.target);
          }
        }
      });
    }, { rootMargin: `0px 0px ${threshold}px 0px` });

    io.observe(element);
  } else {
    callback();
  }
}

theme.stickyHeaderHeight = () => {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--theme-sticky-header-height');
  if (v) {
    return parseInt(v, 10) || 0;
  }
  return 0;
};

theme.getOffsetTopFromDoc = (el) => el.getBoundingClientRect().top + window.scrollY;

theme.getOffsetLeftFromDoc = (el) => el.getBoundingClientRect().left + window.scrollX;

theme.getScrollParent = (node) => {
  const isElement = node instanceof HTMLElement;
  const overflowY = isElement && window.getComputedStyle(node).overflowY;
  const isScrollable = overflowY !== 'visible' && overflowY !== 'hidden';

  if (!node) {
    return null;
  }

  if (isScrollable && node.scrollHeight > node.clientHeight) {
    return node;
  }

  return theme.getScrollParent(node.parentNode) || document.scrollingElement || window;
};

theme.scrollToRevealElement = (el) => {
  const scrollContainer = theme.getScrollParent(el);
  const scrollTop = scrollContainer === window ? window.scrollY : scrollContainer.scrollTop;
  const scrollVisibleHeight = scrollContainer === window
    ? window.innerHeight : scrollContainer.clientHeight;
  const elTop = theme.getOffsetTopFromDoc(el);
  const elBot = elTop + el.offsetHeight;
  const inViewTop = scrollTop + theme.stickyHeaderHeight();
  const inViewBot = scrollTop + scrollVisibleHeight - 50;

  if (elTop < inViewTop || elBot > inViewBot) {
    scrollContainer.scrollTo({
      top: elTop - 100 - theme.stickyHeaderHeight(),
      left: 0,
      behavior: 'smooth'
    });
  }
};

theme.getEmptyOptionSelectors = (formContainer) => {
  const emptySections = [];

  formContainer.querySelectorAll('[data-selector-type="dropdown"].option-selector').forEach((el) => {
    if (!el.querySelector('[aria-selected="true"][data-value]:not([data-value=""])')) {
      emptySections.push(el);
    }
  });

  formContainer.querySelectorAll('[data-selector-type="listed"].option-selector').forEach((el) => {
    if (!el.querySelector('input:checked')) {
      emptySections.push(el);
    }
  });

  return emptySections;
};

theme.suffixIds = (container, prefix) => {
  const suffixCandidates = ['id', 'for', 'aria-describedby', 'aria-controls'];
  for (let i = 0; i < suffixCandidates.length; i += 1) {
    container.querySelectorAll(`[${suffixCandidates[i]}]`).forEach((el) => el.setAttribute(suffixCandidates[i], el.getAttribute(suffixCandidates[i]) + prefix));
  }
};

theme.addDelegateEventListener = (
  element,
  eventName,
  selector,
  callback,
  addEventListenerParams = null
) => {
  const cb = (evt) => {
    const el = evt.target.closest(selector);
    if (!el) return;
    if (!element.contains(el)) return;
    callback.call(el, evt, el);
  };
  element.addEventListener(eventName, cb, addEventListenerParams);
  return cb;
};

theme.hideAndRemove = (el) => {
  // disable
  el.querySelectorAll('input').forEach((input) => { input.disabled = true; });

  // wrap
  const wrapper = document.createElement('div');
  wrapper.className = 'merge-remove-wrapper';
  el.parentNode.insertBefore(wrapper, el);
  wrapper.appendChild(el);
  el.classList.add('merge-remove-item');
  wrapper.style.height = `${wrapper.clientHeight}px`;

  const cs = getComputedStyle(el);
  const fadeDuration = parseFloat(cs.getPropertyValue('--fade-duration')) * 1000;
  const slideDuration = parseFloat(cs.getPropertyValue('--slide-duration')) * 1000;

  setTimeout(() => {
    wrapper.classList.add('merge-remove-wrapper--fade');

    setTimeout(() => {
      wrapper.classList.add('merge-remove-wrapper--slide');

      setTimeout(() => wrapper.remove(), slideDuration);
    }, fadeDuration);
  }, 10);
};

theme.insertAndReveal = (el, target, iaeCmd, delay) => {
  const initialDelay = delay || 10;
  el.classList.add('merge-add-wrapper');
  target.insertAdjacentElement(iaeCmd, el);
  el.style.height = `${el.firstElementChild.clientHeight}px`;

  const cs = getComputedStyle(el);
  const fadeDuration = parseFloat(cs.getPropertyValue('--fade-duration')) * 1000;
  const slideDuration = parseFloat(cs.getPropertyValue('--slide-duration')) * 1000;

  setTimeout(() => {
    el.classList.add('merge-add-wrapper--slide');

    setTimeout(() => {
      el.classList.add('merge-add-wrapper--fade');

      setTimeout(() => {
        // tidy up
        el.style.height = '';
        el.classList.remove('merge-add-wrapper', 'merge-add-wrapper--slide', 'merge-add-wrapper--fade');
      }, fadeDuration);
    }, slideDuration);
  }, initialDelay);
};

theme.mergeNodes = (newContent, targetContainer) => {
  try {
    // merge: replace content if changed
    newContent.querySelectorAll('[data-merge]').forEach((newEl) => {
      const targetEl = targetContainer.querySelector(`[data-merge="${newEl.dataset.merge}"]`);
      if (!newEl.dataset.mergeCache
        || !targetEl.dataset.mergeCache
        || newEl.dataset.mergeCache !== targetEl.dataset.mergeCache) {
        targetEl.innerHTML = newEl.innerHTML;
        if (newEl.dataset.mergeCache || targetEl.dataset.mergeCache) {
          targetEl.dataset.mergeCache = newEl.dataset.mergeCache;
        }
      }
    });
    // merge: attributes only
    newContent.querySelectorAll('[data-merge-attributes]').forEach((newEl) => {
      const targetEl = targetContainer.querySelector(`[data-merge-attributes="${newEl.dataset.mergeAttributes}"]`);
      const newElAttributeNames = newEl.getAttributeNames();
      for (let i = 0; i < newElAttributeNames.length; i += 1) {
        const attributeName = newElAttributeNames[i];
        targetEl.setAttribute(attributeName, newEl.getAttribute(attributeName));
      }
    });
    // merge: insert/remove/replace in list
    newContent.querySelectorAll('[data-merge-list]').forEach((newList) => {
      const targetList = targetContainer.querySelector(`[data-merge-list="${newList.dataset.mergeList}"]`);
      let targetListItems = Array.from(targetList.querySelectorAll('[data-merge-list-item]'));
      const newListItems = Array.from(newList.querySelectorAll('[data-merge-list-item]'));

      // remove
      targetListItems.forEach((targetListItem) => {
        // eslint-disable-next-line max-len
        const matchedItem = newListItems.find((item) => item.dataset.mergeListItem === targetListItem.dataset.mergeListItem);
        if (!matchedItem) {
          theme.hideAndRemove(targetListItem);
        }
      });

      // rebuild target list excluding removed items
      targetListItems = Array.from(targetList.querySelectorAll('[data-merge-list-item]:not(.merge-remove-item)'));

      for (let i = 0; i < newListItems.length; i += 1) {
        const newListItem = newListItems[i];
        // eslint-disable-next-line max-len
        const matchedItem = targetListItems.find((item) => item.dataset.mergeListItem === newListItem.dataset.mergeListItem);
        if (matchedItem) {
          // replace if changed
          if (!newListItem.dataset.mergeCache
            || !matchedItem.dataset.mergeCache
            || newListItem.dataset.mergeCache !== matchedItem.dataset.mergeCache) {
            matchedItem.innerHTML = newListItem.innerHTML;
            if (newListItem.dataset.mergeCache) {
              matchedItem.dataset.mergeCache = newListItem.dataset.mergeCache;
            }
          }
        } else {
          // add
          if (i === 0) {
            // first place
            theme.insertAndReveal(newListItem, targetList, 'afterbegin', 500);
          } else if (i >= targetListItems.length) {
            // at end
            theme.insertAndReveal(newListItem, targetList, 'beforeend', 500);
          } else {
            // before element currently at that index
            theme.insertAndReveal(newListItem, targetListItems[i], 'beforebegin', 500);
          }
          // update target list
          targetListItems.splice(i, 0, newListItem);
        }
      }
    });
  } catch (ex) {
    window.location.reload();
  }
};

// Show a short-lived text popup above an element
theme.showQuickPopup = (message, origin) => {
  const offsetLeft = theme.getOffsetLeftFromDoc(origin);
  const offsetTop = theme.getOffsetTopFromDoc(origin);
  const originLeft = origin.getBoundingClientRect().left;
  const popup = document.createElement('div');
  popup.className = 'simple-popup simple-popup--hidden';
  popup.innerHTML = message;
  popup.style.left = `${offsetLeft}px`;
  popup.style.top = `${offsetTop}px`;

  document.body.appendChild(popup);

  let marginLeft = -(popup.clientWidth - origin.clientWidth) / 2;
  if ((originLeft + marginLeft) < 0) {
    // Pull it away from the left edge of the screen
    marginLeft -= (originLeft + marginLeft) - 2;
  }
  // Pull from right edge + small gap
  const offsetRight = offsetLeft + marginLeft + popup.clientWidth + 5;
  if (offsetRight > window.innerWidth) {
    marginLeft -= (offsetRight - window.innerWidth);
  }
  popup.style.marginTop = -popup.clientHeight - 10;
  popup.style.marginLeft = marginLeft;
  setTimeout(() => {
    popup.classList.remove('simple-popup--hidden');
  }, 10);
  setTimeout(() => {
    popup.classList.add('simple-popup--hidden');
  }, 3500);
  setTimeout(() => {
    popup.remove();
  }, 4000);
};

theme.manuallyLoadImages = (container) => {
  container.querySelectorAll('img[data-manual-src]').forEach((el) => {
    el.src = el.dataset.manualSrc;
    el.removeAttribute('data-manual-src');
    if (el.dataset.manualSrcset) {
      el.srcset = el.dataset.manualSrcset;
      el.removeAttribute('data-manual-srcset');
    }
  });
};

theme.whenComponentLoaded = (component, callback) => {
  const components = Symbol.iterator in Object(component) ? [...component] : [component];
  if (!components.find((c) => !c.hasAttribute('loaded'))) {
    callback();
    return;
  }
  const onMutation = (mutationList, observer) => {
    for (let i = 0; i < mutationList.length; i += 1) {
      const mutation = mutationList[i];
      if (mutation.type === 'attributes') {
        if (!components.find((c) => !c.hasAttribute('loaded'))) {
          observer.disconnect();
          callback.call();
        }
      }
    }
  };
  const observer = new MutationObserver(onMutation);
  components.forEach((c) => observer.observe(c, { attributes: true, attributeFilter: ['loaded'] }));
};

/**
 * Returns a function that as long as it continues to be invoked, won't be triggered.
 * @param {Function} fn - Callback function.
 * @param {number} [wait=300] - Delay (in milliseconds).
 * @returns {Function}
 */
function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

window.addEventListener(
  'resize',
  debounce(() => {
    window.dispatchEvent(new CustomEvent('on:debounced-resize'));
  })
);

/**
 * Creates a 'mediaMatches' object from the media queries specified in the theme,
 * and adds listeners for each media query. If a breakpoint is crossed, the mediaMatches
 * values are updated and a 'on:breakpoint-change' event is dispatched.
 */
(() => {
  const { mediaQueries } = theme;
  if (!mediaQueries) return;

  const mqKeys = Object.keys(mediaQueries);
  const mqLists = {};
  theme.mediaMatches = {};

  /**
   * Handles a media query (breakpoint) change.
   */
  const handleMqChange = () => {
    const newMatches = mqKeys.reduce((acc, media) => {
      acc[media] = !!(mqLists[media] && mqLists[media].matches);
      return acc;
    }, {});

    // Update mediaMatches values after breakpoint change.
    Object.keys(newMatches).forEach((key) => {
      theme.mediaMatches[key] = newMatches[key];
    });

    window.dispatchEvent(new CustomEvent('on:breakpoint-change'));
  };

  mqKeys.forEach((mq) => {
    // Create mqList object for each media query.
    mqLists[mq] = window.matchMedia(mediaQueries[mq]);

    // Get initial matches for each query.
    theme.mediaMatches[mq] = mqLists[mq].matches;

    // Add an event listener to each query.
    try {
      mqLists[mq].addEventListener('change', handleMqChange);
    } catch (err1) {
      // Fallback for legacy browsers (Safari < 14).
      mqLists[mq].addListener(handleMqChange);
    }
  });
})();

/**
 * Sets a 'viewport-height' custom property on the root element.
 */
function setViewportHeight() {
  document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
}

/**
 * Sets a 'header-height' custom property on the root element.
 */
function setHeaderHeight() {
  const header = document.querySelector('.js-header-height');
  if (!header) return;
  let height = header.offsetHeight;

  // Add announcement bar height (if shown).
  const announcement = document.querySelector('.cc-announcement');
  const announcementHeight = announcement ? announcement.offsetHeight : 0;
  height += announcementHeight;

  document.documentElement.style.setProperty('--announcement-height', `${announcementHeight}px`);
  document.documentElement.style.setProperty('--header-height', `${height}px`);
}

/**
 * Sets a 'scrollbar-width' custom property on the root element.
 */
function setScrollbarWidth() {
  document.documentElement.style.setProperty(
    '--scrollbar-width',
    `${window.innerWidth - document.documentElement.clientWidth}px`
  );
}

/**
 * Sets the dimension variables.
 */
function setDimensionVariables() {
  setViewportHeight();
  setHeaderHeight();
  setScrollbarWidth();
}

// Set the dimension variables once the DOM is loaded
document.addEventListener('DOMContentLoaded', setDimensionVariables);

// Update the dimension variables if viewport resized.
window.addEventListener('resize', debounce(setDimensionVariables, 400));

// iOS alters screen width without resize event, if unexpectedly wide content is found
setTimeout(setViewportHeight, 3000);

/**
 * Pauses all media (videos/models) within an element.
 * @param {Element} [el=document] - Element to pause media within.
 */
function pauseAllMedia(el = document) {
  el.querySelectorAll('.js-youtube, .js-vimeo, video').forEach((video) => {
    const component = video.closest('video-component');
    if (component && component.dataset.background === 'true') return;

    if (video.matches('.js-youtube')) {
      video.contentWindow.postMessage('{ "event": "command", "func": "pauseVideo", "args": "" }', '*');
    } else if (video.matches('.js-vimeo')) {
      video.contentWindow.postMessage('{ "method": "pause" }', '*');
    } else {
      video.pause();
    }
  });

  el.querySelectorAll('product-model').forEach((model) => {
    if (model.modelViewerUI) model.modelViewerUI.pause();
  });
}

class DeferredMedia extends HTMLElement {
  constructor() {
    super();

    const loadBtn = this.querySelector('.js-load-media');
    if (loadBtn) {
      loadBtn.addEventListener('click', this.loadContent.bind(this));
    } else {
      this.addObserver();
    }
  }

  /**
   * Adds an Intersection Observer to load the content when viewport scroll is near
   */
  addObserver() {
    if ('IntersectionObserver' in window === false) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          this.loadContent(false, false, 'observer');
          observer.unobserve(this);
        }
      });
    }, { rootMargin: '0px 0px 1000px 0px' });

    observer.observe(this);
  }

  /**
   * Loads the deferred media.
   * @param {boolean} [focus=true] - Focus the deferred media element after loading.
   * @param {boolean} [pause=true] - Whether to pause all media after loading.
   * @param {string} [loadTrigger='click'] - The action that caused the deferred content to load.
   */
  loadContent(focus = true, pause = true, loadTrigger = 'click') {
    if (pause) pauseAllMedia();
    if (this.getAttribute('loaded') !== null) return;

    this.loadTrigger = loadTrigger;
    const content = this.querySelector('template').content.firstElementChild.cloneNode(true);
    this.appendChild(content);
    this.setAttribute('loaded', '');

    const deferredEl = this.querySelector('video, model-viewer, iframe');
    if (deferredEl && focus) deferredEl.focus();
  }
}

customElements.define('deferred-media', DeferredMedia);

class DetailsDisclosure extends HTMLElement {
  constructor() {
    super();
    this.disclosure = this.querySelector('details');
    this.toggle = this.querySelector('summary');
    this.panel = this.toggle.nextElementSibling;
    this.init();
  }

  init() {
    // Check if the content element has a CSS transition.
    if (window.getComputedStyle(this.panel).transitionDuration !== '0s') {
      this.toggle.addEventListener('click', this.handleToggle.bind(this));
      this.disclosure.addEventListener('transitionend', this.handleTransitionEnd.bind(this));
    }
  }

  /**
   * Handles 'click' events on the summary element.
   * @param {object} evt - Event object.
   */
  handleToggle(evt) {
    evt.preventDefault();

    if (!this.disclosure.open) {
      this.open();
    } else {
      this.close();
    }
  }

  /**
   * Handles 'transitionend' events on the details element.
   * @param {object} evt - Event object.
   */
  handleTransitionEnd(evt) {
    if (evt.target !== this.panel) return;

    if (this.disclosure.classList.contains('is-closing')) {
      this.disclosure.classList.remove('is-closing');
      this.disclosure.open = false;
    }

    this.panel.removeAttribute('style');
  }

  /**
   * Adds inline 'height' style to the content element, to trigger open transition.
   */
  addContentHeight() {
    this.panel.style.height = `${this.panel.scrollHeight}px`;
  }

  /**
   * Opens the details element.
   */
  open() {
    // Set content 'height' to zero before opening the details element.
    this.panel.style.height = '0';

    // Open the details element
    this.disclosure.open = true;

    // Set content 'height' to its scroll height, to enable CSS transition.
    this.addContentHeight();
  }

  /**
   * Closes the details element.
   */
  close() {
    // Set content height to its scroll height, to enable transition to zero.
    this.addContentHeight();

    // Add class to enable styling of content or toggle icon before or during close transition.
    this.disclosure.classList.add('is-closing');

    // Set content height to zero to trigger the transition.
    // Slight delay required to allow scroll height to be applied before changing to '0'.
    setTimeout(() => {
      this.panel.style.height = '0';
    });
  }
}

customElements.define('details-disclosure', DetailsDisclosure);

if (!customElements.get('gift-card-recipient')) {
  class GiftCardRecipient extends HTMLElement {
    connectedCallback() {
      this.recipientEmail = this.querySelector('[name="properties[Recipient email]"]');
      this.recipientEmailLabel = this.querySelector(`label[for="${this.recipientEmail.id}"]`);
      this.recipientName = this.querySelector('[name="properties[Recipient name]"]');
      this.recipientMessage = this.querySelector('[name="properties[Message]"]');
      this.recipientSendOn = this.querySelector('[name="properties[Send on]"]');
      this.recipientOffsetProperty = this.querySelector('[name="properties[__shopify_offset]"]');

      // When JS is enabled, the recipient email field is required.
      // Input labels are changed to reflect this.
      if (this.recipientEmailLabel && this.recipientEmailLabel.dataset.jsLabel) {
        this.recipientEmailLabel.innerText = this.recipientEmailLabel.dataset.jsLabel;
      }

      // Set the timezone offset property input and enable it
      if (this.recipientOffsetProperty) {
        this.recipientOffsetProperty.value = new Date().getTimezoneOffset().toString();
        this.recipientOffsetProperty.removeAttribute('disabled');
      }

      this.recipientCheckbox = this.querySelector('.gift-card-recipient__checkbox');
      this.recipientCheckbox.addEventListener('change', () => this.synchronizeProperties());
      this.synchronizeProperties();
    }

    synchronizeProperties() {
      if (this.recipientCheckbox.checked) {
        this.recipientEmail.setAttribute('required', '');
        this.recipientEmail.removeAttribute('disabled');
        this.recipientName.removeAttribute('disabled');
        this.recipientMessage.removeAttribute('disabled');
        this.recipientSendOn.removeAttribute('disabled');
        if (this.recipientOffsetProperty) {
          this.recipientOffsetProperty.removeAttribute('disabled');
        }
      } else {
        this.recipientEmail.removeAttribute('required');
        this.recipientEmail.setAttribute('disabled', '');
        this.recipientName.setAttribute('disabled', '');
        this.recipientMessage.setAttribute('disabled', '');
        this.recipientSendOn.setAttribute('disabled', '');
        if (this.recipientOffsetProperty) {
          this.recipientOffsetProperty.setAttribute('disabled', '');
        }
      }
    }
  }

  customElements.define('gift-card-recipient', GiftCardRecipient);
}

const trapFocusHandlers = {};

/**
 * Removes focus trap event listeners and optionally focuses an element.
 * @param {Element} [elementToFocus=null] - Element to focus when trap is removed.
 */
function removeTrapFocus(elementToFocus = null) {
  document.removeEventListener('focusin', trapFocusHandlers.focusin);
  document.removeEventListener('focusout', trapFocusHandlers.focusout);
  document.removeEventListener('keydown', trapFocusHandlers.keydown);

  if (elementToFocus) elementToFocus.focus();
}

/**
 * Traps focus within a container, e.g. modal or side drawer.
 * @param {Element} container - Container element to trap focus within.
 * @param {Element} [elementToFocus=container] - Initial element to focus when trap is applied.
 */
function trapFocus(container, elementToFocus = container) {
  const focusableEls = Array.from(
    container.querySelectorAll('summary, a[href], area[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), object, iframe, audio[controls], video[controls], [tabindex]:not([tabindex^="-"])')
  );

  const firstEl = focusableEls[0];
  const lastEl = focusableEls[focusableEls.length - 1];

  removeTrapFocus();

  trapFocusHandlers.focusin = (evt) => {
    if (evt.target !== container && evt.target !== lastEl && evt.target !== firstEl) return;
    document.addEventListener('keydown', trapFocusHandlers.keydown);
  };

  trapFocusHandlers.focusout = () => {
    document.removeEventListener('keydown', trapFocusHandlers.keydown);
  };

  trapFocusHandlers.keydown = (evt) => {
    if (evt.code !== 'Tab') return;

    // If tab pressed on last focusable element, focus the first element.
    if (evt.target === lastEl && !evt.shiftKey) {
      evt.preventDefault();
      firstEl.focus();
    }

    //  If shift + tab pressed on the first focusable element, focus the last element.
    if ((evt.target === container || evt.target === firstEl) && evt.shiftKey) {
      evt.preventDefault();
      lastEl.focus();
    }
  };

  document.addEventListener('focusout', trapFocusHandlers.focusout);
  document.addEventListener('focusin', trapFocusHandlers.focusin);

  (elementToFocus || container).focus();
}

class Modal extends HTMLElement {
  constructor() {
    super();
    this.addEventListener('click', this.handleClick.bind(this));
  }

  /**
   * Handles 'click' events on the modal.
   * @param {object} evt - Event object.
   */
  handleClick(evt) {
    if (evt.target !== this && !evt.target.matches('.js-close-modal')) return;
    this.close();
  }

  /**
   * Opens the modal.
   * @param {Element} opener - Modal opener element.
   */
  open(opener) {
    this.setAttribute('open', '');
    this.openedBy = opener;

    trapFocus(this);
    window.pauseAllMedia();

    // Add event handler (so the bound event listener can be removed).
    this.keyupHandler = (evt) => evt.key === 'Escape' && this.close();

    // Add event listener (for while modal is open).
    this.addEventListener('keyup', this.keyupHandler);

    // Wrap tables in a '.scrollable-table' element for a better mobile experience.
    this.querySelectorAll('table').forEach((table) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'scrollable-table';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }

  /**
   * Closes the modal.
   */
  close() {
    this.removeAttribute('open');

    removeTrapFocus(this.openedBy);
    window.pauseAllMedia();

    // Remove event listener added on modal opening.
    this.removeEventListener('keyup', this.keyupHandler);
  }
}

customElements.define('modal-dialog', Modal);

class ModalOpener extends HTMLElement {
  constructor() {
    super();

    const button = this.querySelector('button');
    if (!button) return;

    button.addEventListener('click', () => {
      const modal = document.getElementById(this.dataset.modal);
      if (modal) modal.open(button);
    });
  }
}

customElements.define('modal-opener', ModalOpener);

class SideDrawer extends HTMLElement {
  constructor() {
    super();
    this.overlay = document.querySelector('.js-overlay');
  }

  /**
   * Handles a 'click' event on the drawer.
   * @param {object} evt - Event object.
   */
  handleClick(evt) {
    if (evt.target.matches('.js-close-drawer') || evt.target === this.overlay) {
      this.close();
    }
  }

  /**
   * Opens the drawer.
   * @param {Element} [opener] - Element that triggered opening of the drawer.
   * @param {Element} [elementToFocus] - Element to focus after drawer opened.
   * @param {Function} [callback] - Callback function to trigger after the open has completed
   */
  open(opener, elementToFocus, callback) {
    this.dispatchEvent(new CustomEvent(`on:${this.dataset.name}:before-open`, {
      bubbles: true
    }));

    this.overlay.classList.add('is-visible');
    this.setAttribute('open', '');
    this.setAttribute('aria-hidden', 'false');
    this.opener = opener;

    trapFocus(this, elementToFocus);

    // Create event handler variables (so the bound event listeners can be removed).
    this.clickHandler = this.clickHandler || this.handleClick.bind(this);
    this.keyupHandler = (evt) => {
      if (evt.key !== 'Escape' || evt.target.closest('.cart-drawer-popup')) return;
      this.close();
    };

    // Add event listeners (for while drawer is open).
    this.addEventListener('click', this.clickHandler);
    this.addEventListener('keyup', this.keyupHandler);
    this.overlay.addEventListener('click', this.clickHandler);

    // Handle events after the drawer opens
    const transitionDuration = parseFloat(getComputedStyle(this).getPropertyValue('--longest-transition-in-ms'));
    setTimeout(() => {
      if (callback) callback();
      this.dispatchEvent(new CustomEvent(`on:${this.dataset.name}:after-open`, {
        bubbles: true
      }));
    }, transitionDuration);
  }

  /**
   * Closes the drawer.
   * @param {Function} [callback] - Call back function to trigger after the close has completed
   */
  close(callback) {
    this.dispatchEvent(new CustomEvent(`on:${this.dataset.name}:before-close`, {
      bubbles: true
    }));

    this.removeAttribute('open');
    this.setAttribute('aria-hidden', 'true');
    this.overlay.classList.remove('is-visible');

    removeTrapFocus(this.opener);

    // Remove event listeners added on drawer opening.
    this.removeEventListener('click', this.clickHandler);
    this.removeEventListener('keyup', this.keyupHandler);
    this.overlay.removeEventListener('click', this.clickHandler);

    // Handle events after the drawer closes
    const transitionDuration = parseFloat(getComputedStyle(this).getPropertyValue('--longest-transition-in-ms'));
    setTimeout(() => {
      if (callback) callback();
      this.dispatchEvent(new CustomEvent(`on:${this.dataset.name}:after-close`, {
        bubbles: true
      }));
    }, transitionDuration);
  }
}

customElements.define('side-drawer', SideDrawer);

class BuyButtons extends HTMLElement {
  constructor() {
    super();
    window.initLazyScript(this, this.initLazySection.bind(this));
  }

  initLazySection() {
    this.dynamicPaymentButtonTemplate = this.querySelector('.dynamic-payment-button-template');

    if (this.dynamicPaymentButtonTemplate) {
      this.variantIdInput = this.querySelector('[name="id"]');

      if (this.variantIdInput.value) {
        this.tryInitDynamicPaymentButton();
      } else {
        this.boundTryInitDynamicPaymentButtonOnChange = this.tryInitDynamicPaymentButton.bind(this);
        this.variantIdInput.addEventListener('change', this.boundTryInitDynamicPaymentButtonOnChange);
      }
    }
  }

  /**
   * Initialise dynamic payment button, if variant exists
   */
  tryInitDynamicPaymentButton() {
    if (this.variantIdInput.value) {
      if (this.boundTryInitDynamicPaymentButtonOnChange) {
        this.variantIdInput.removeEventListener('change', this.boundTryInitDynamicPaymentButtonOnChange);
      }

      this.dynamicPaymentButtonTemplate.insertAdjacentHTML('afterend', this.dynamicPaymentButtonTemplate.innerHTML);
      this.dynamicPaymentButtonTemplate.remove();

      if (Shopify.PaymentButton) {
        Shopify.PaymentButton.init();
      }
    }
  }
}

customElements.define('buy-buttons', BuyButtons);

const CartForm = class extends HTMLElement {
  connectedCallback() {
    this.enableAjaxUpdate = this.dataset.ajaxUpdate;

    if (this.enableAjaxUpdate) {
      this.sectionId = this.dataset.sectionId;
      this.boundRefresh = this.refresh.bind(this);
      document.addEventListener('on:cart:change', this.boundRefresh);

      theme.addDelegateEventListener(this, 'click', '.cart-item__remove', (evt) => {
        evt.preventDefault();
        this.adjustItemQuantity(evt.target.closest('.cart-item'), { to: 0 });
      });

      theme.addDelegateEventListener(this, 'click', '.quantity-down', (evt) => {
        evt.preventDefault();
        this.adjustItemQuantity(evt.target.closest('.cart-item'), { decrease: true });
      });

      theme.addDelegateEventListener(this, 'click', '.quantity-up', (evt) => {
        evt.preventDefault();
        this.adjustItemQuantity(evt.target.closest('.cart-item'), { increase: true });
      });

      theme.addDelegateEventListener(this, 'change', '.cart-item__quantity-input', (evt) => {
        this.adjustItemQuantity(evt.target.closest('.cart-item'), { currentValue: true });
      });
    }
  }

  disconnectedCallback() {
    if (this.enableAjaxUpdate) {
      document.removeEventListener('on:cart:change', this.boundRefresh);
    }
  }

  refresh() {
    this.classList.add('cart-form--refreshing');
    fetch(`${window.Shopify.routes.root}?section_id=${this.sectionId}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.text();
      })
      .then((response) => {
        this.refreshFromHtml(response);
      });
  }

  refreshFromHtml(html) {
    const frag = document.createDocumentFragment();
    const newContent = document.createElement('div');
    frag.appendChild(newContent);
    newContent.innerHTML = html;

    newContent.querySelectorAll('[data-cc-animate]').forEach((el) => el.removeAttribute('data-cc-animate'));

    theme.mergeNodes(newContent, this);

    this.classList.remove('cart-form--refreshing');
    this.querySelectorAll('.merge-item-refreshing').forEach((el) => el.classList.remove('merge-item-refreshing'));

    this.dispatchEvent(
      new CustomEvent('on:cart:after-merge', { bubbles: true, cancelable: false })
    );

    if (theme.settings.afterAddToCart === 'drawer' && this.closest('.drawer') && !this.closest('.drawer').hasAttribute('open')) {
      document.dispatchEvent(
        new CustomEvent('theme:open-cart-drawer', { bubbles: true, cancelable: false })
      );
    }
  }

  adjustItemQuantity(item, change) {
    const quantityInput = item.querySelector('.cart-item__quantity-input');

    let newQuantity = parseInt(quantityInput.value, 10);
    if (typeof change.to !== 'undefined') {
      newQuantity = change.to;
      quantityInput.value = newQuantity;
    } else if (change.increase) {
      newQuantity += quantityInput.step || 1;
      quantityInput.value = newQuantity;
    } else if (change.decrease) {
      newQuantity -= quantityInput.step || 1;
      quantityInput.value = newQuantity;
    } else if (change.currentValue) ;

    if (quantityInput.max && parseInt(quantityInput.value, 10) > parseInt(quantityInput.max, 10)) {
      newQuantity = quantityInput.max;
      quantityInput.value = newQuantity;
      theme.showQuickPopup(theme.strings.cartItemsQuantityError.replace('[QUANTITY]', quantityInput.max), quantityInput);
    }

    clearTimeout(this.adjustItemQuantityTimeout);
    this.adjustItemQuantityTimeout = setTimeout(() => {
      const updateParam = { updates: {} };
      this.querySelectorAll('.cart-item__quantity-input:not([disabled])').forEach((el) => {
        updateParam.updates[el.dataset.key] = el.value;
        if (el.value !== el.dataset.initialValue) {
          el.closest('[data-merge-list-item]').classList.add('merge-item-refreshing');
        }
      });
      fetch(theme.routes.cartUpdate, {
        method: 'POST',
        body: JSON.stringify(updateParam),
        headers: {
          'Content-Type': 'application/json'
        }
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          document.dispatchEvent(
            new CustomEvent('on:cart:change', { bubbles: true, cancelable: false })
          );
        })
        .catch((error) => {
          // eslint-disable-next-line no-console
          console.log(error.message);
          this.dispatchEvent(new CustomEvent('on:cart:error', {
            bubbles: true,
            detail: {
              error: error.message
            }
          }));
          // Uncertainty... Reload page.
          window.location.reload();
        });
    }, newQuantity === 0 ? 10 : 700);
  }
};

window.customElements.define('cart-form', CartForm);

const CCCartCrossSell = class extends HTMLElement {
  init() {
    this.productList = this.querySelector('.product-grid');

    if (this.dataset.from) {
      fetch(this.dataset.from)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.text();
        })
        .then((response) => {
          const frag = document.createDocumentFragment();
          const newContent = document.createElement('div');
          frag.appendChild(newContent);
          newContent.innerHTML = response;

          const pl = newContent.querySelector('.product-grid');
          if (pl) {
            this.productList.innerHTML = pl.innerHTML;
            this.querySelectorAll('.product-block').forEach((el) => el.classList.add('slider__item'));
            this.querySelectorAll('carousel-slider').forEach((el) => el.refresh());
          } else {
            this.classList.add('hidden');
          }
        });
    }
  }
};

window.customElements.define('cc-cart-cross-sell', CCCartCrossSell);

const CCFetchedContent = class extends HTMLElement {
  connectedCallback() {
    fetch(this.dataset.url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.text();
      })
      .then((response) => {
        const frag = document.createDocumentFragment();
        const newContent = document.createElement('div');
        frag.appendChild(newContent);
        newContent.innerHTML = response;

        const replacementContent = newContent.querySelector(`[data-id="${this.dataset.id}"]`);
        if (replacementContent) {
          this.innerHTML = replacementContent.innerHTML;
        }
      });
  }
};

window.customElements.define('cc-fetched-content', CCFetchedContent);

/**
 * Returns a function, that, when invoked, will only be triggered at most once during
 * a given window of time.
 * @param {Function} fn - Callback function.
 * @param {number} [wait=300] - Time window (in milliseconds).
 * @returns {Function}
 */
function throttle(fn, wait = 300) {
  let throttleTimeoutId = -1;
  let tick = false;

  return () => {
    clearTimeout(throttleTimeoutId);
    throttleTimeoutId = setTimeout(fn, wait);

    if (!tick) {
      fn.call();
      tick = true;
      setTimeout(() => {
        tick = false;
      }, wait);
    }
  };
}

const FilterContainer = class extends HTMLElement {
  constructor() {
    super();
    this.section = this.closest('.shopify-section');
    this.filters = this.querySelector('.filters');

    const utilityBar = document.querySelector('.utility-bar');
    if (utilityBar) {
      // duplicate utility bar for mobile
      this.utilBarClone = utilityBar.cloneNode(true);
      this.utilBarClone.classList.add('utility-bar--sticky-mobile-copy');
      this.utilBarClone.removeAttribute('data-ajax-container');
      utilityBar.insertAdjacentElement('afterend', this.utilBarClone);
      // ensure ids are unique
      theme.suffixIds(this.utilBarClone, 'dupe');

      this.previousScrollTop = window.scrollY;
      this.throttledCheckStickyScroll = throttle(this.checkStickyScroll.bind(this), 200);
    }

    if (this.filters) {
      // auto-select availability
      this.allowAutoApplyHideUnavailable = this.filters.dataset.autoApplyHideUnavailable === 'true';
      if (this.allowAutoApplyHideUnavailable) {
        theme.addDelegateEventListener(this, 'change', '.filter-group__checkbox, .cc-price-range__input', (evt, delEl) => {
          if (this.allowAutoApplyHideUnavailable) {
            if ((delEl.type === 'checkbox' && delEl.checked) || (delEl.type === 'text' && delEl.value)) {
              const toEnable = this.filters.querySelector('[name="filter.v.availability"][value="1"]');
              if (toEnable) {
                toEnable.checked = true;
                toEnable.dispatchEvent(
                  new CustomEvent('change', { bubbles: true, cancelable: false })
                );
              }
            }
          }
        });

        theme.addDelegateEventListener(this, 'change', '.filter-group--availability .filter-toggle__input', (evt, delEl) => {
          if (delEl.checked && delEl.value === '1') {
            this.allowAutoApplyHideUnavailable = false;
          }
        });
      }

      // ajax filter
      if (this.dataset.ajaxFiltering === 'true') {
        // ajax load form submission
        const debouncedAjaxLoadForm = debounce(this.ajaxLoadForm.bind(this), 700);
        theme.addDelegateEventListener(this, 'change', '#CollectionFilterForm', debouncedAjaxLoadForm);
        theme.addDelegateEventListener(this, 'submit', '#CollectionFilterForm', debouncedAjaxLoadForm);
      } else {
        theme.addDelegateEventListener(this, 'change', '#CollectionFilterForm', (_evt, delEl) => delEl.submit());
      }

      // init things that may need re-initialising on ajax load
      this.initFiltersEtc();
    }

    // ajax sort, filter, and pagination
    if (this.dataset.ajaxFiltering === 'true') {
      // ajax load on link click
      theme.addDelegateEventListener(this.section, 'click', '.link-dropdown__link, .filter-group__applied-item, .filter-group__clear-link, .pagination a', (evt, delEl) => {
        evt.preventDefault();
        this.ajaxLoadUrl(delEl.href);
      });
    }
  }

  connectedCallback() {
    // scroll
    if (this.throttledCheckStickyScroll) {
      window.addEventListener('scroll', this.throttledCheckStickyScroll);
    }

    // back button
    if (this.dataset.ajaxFiltering === 'true') {
      this.boundAjaxPopState = this.ajaxPopState.bind(this);
      window.addEventListener('popstate', this.boundAjaxPopState);
    }

    // layout switch
    if (this.section.querySelector('.layout-switchers')) {
      this.boundSwitchGridLayout = theme.addDelegateEventListener(this.section, 'click', '.layout-switch', this.switchGridLayout.bind(this));
    }

    // show/hide filters
    this.delegatedToggleFiltersCallback = theme.addDelegateEventListener(this.section, 'click', '[data-toggle-filters]', (evt) => {
      evt.preventDefault();
      this.classList.toggle('filter-container--show-filters-desktop');
      this.classList.toggle('filter-container--show-filters-mobile');
      const isNowVisible = this.classList.contains('filter-container--show-filters-desktop');
      this.section.querySelectorAll('.toggle-btn[data-toggle-filters]').forEach((el) => {
        el.classList.toggle('toggle-btn--revealed-desktop', isNowVisible);
      });
    });
  }

  disconnectedCallback() {
    if (this.boundCheckStickyScroll) {
      window.removeEventListener('scroll', this.throttledCheckStickyScroll);
    }

    if (this.boundAjaxPopState) {
      window.removeEventListener('popstate', this.boundAjaxPopState);
    }
  }

  initFiltersEtc() {
    this.classList.add('filter-container--mobile-initialised');

    // append query vars onto sort urls (e.g. filters, vendor collection)
    if (window.location.href.indexOf('?') >= 0) {
      document.querySelectorAll('#sort-dropdown-options .link-dropdown__link').forEach((el) => {
        const queryTerms = window.location.href.split('?')[1].split('&');
        let newHref = el.href;
        queryTerms.forEach((term) => {
          if (term.indexOf('sort_by=') === -1) {
            newHref += `&${term}`;
          }
        });
        el.href = newHref;
      });
    }
  }

  switchGridLayout(evt) {
    evt.preventDefault();
    if (evt.target.classList.contains('layout-switch--one-column')) {
      this.querySelectorAll('.product-grid').forEach((el) => {
        el.classList.remove('product-grid--per-row-mob-2');
        el.classList.add('product-grid--per-row-mob-1');
      });
    } else {
      this.querySelectorAll('.product-grid').forEach((el) => {
        el.classList.remove('product-grid--per-row-mob-1');
        el.classList.add('product-grid--per-row-mob-2');
      });
    }
    evt.target.classList.add('layout-switch--active');
    (evt.target.nextElementSibling || evt.target.previousElementSibling).classList.remove('layout-switch--active');
  }

  checkStickyScroll() {
    const utilityBarOffsetY = theme.getOffsetTopFromDoc(this.section.querySelector('.utility-bar'));
    if (window.innerWidth < 768
        && this.previousScrollTop > window.scrollY
        && window.scrollY > utilityBarOffsetY) {
      document.body.classList.add('utility-bar-sticky-mobile-copy-reveal');
    } else {
      document.body.classList.remove('utility-bar-sticky-mobile-copy-reveal');
    }
    this.previousScrollTop = window.scrollY;
  }

  ajaxLoadForm(evt) {
    if (evt.type === 'submit') {
      evt.preventDefault();
    }
    const queryVals = [];
    this.filters.querySelectorAll('input, select').forEach((input) => {
      if (
        ((input.type !== 'checkbox' && input.type !== 'radio') || input.checked) // is an active input value
        && input.value !== '' // has a value
      ) {
        queryVals.push([input.name, encodeURIComponent(input.value)]);
      }
    });
    // new url
    let newUrl = window.location.pathname;
    queryVals.forEach((value) => {
      newUrl += `&${value[0]}=${value[1]}`;
    });
    newUrl = newUrl.replace('&', '?');
    // load
    this.ajaxLoadUrl.call(this, newUrl);
  }

  ajaxPopState() {
    this.ajaxLoadUrl.call(this, document.location.href, true);
  }

  ajaxLoadUrl(url, noPushState) {
    if (!noPushState) {
      // update url history
      let fullUrl = url;
      if (fullUrl.slice(0, 1) === '/') {
        fullUrl = `${window.location.protocol}//${window.location.host}${fullUrl}`;
      }
      window.history.pushState({ path: fullUrl }, '', fullUrl);
    }

    // limit render to section, if possible (added after pushState)
    let fetchUrl = url;
    if (this.dataset.filterSectionId) {
      fetchUrl = `${url}${url.indexOf('?') >= 0 ? '&' : '?'}section_id=${this.dataset.filterSectionId}`;
    }

    // start fetching URL
    const refreshContainerSelector = '[data-ajax-container]';
    const ajaxContainers = this.section.querySelectorAll(refreshContainerSelector);

    // loading state
    ajaxContainers.forEach((el) => el.classList.add('ajax-loading'));

    // cancel current fetch & fetch next
    if (this.ajaxLoadUrlFetchAbortController) {
      this.ajaxLoadUrlFetchAbortController.abort('Existing request not needed');
    }
    this.ajaxLoadUrlFetchAbortController = new AbortController();

    fetch(fetchUrl, {
      method: 'get',
      signal: this.ajaxLoadUrlFetchAbortController.signal
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.text();
      })
      .then((response) => {
        // save active element
        if (document.activeElement) {
          this.activeElementId = document.activeElement.id;
        }

        // before replace - check if container scrolls, if so find item at scroll top
        const scrollContainer = this.querySelector('.filters');
        let elAboveScrollTopData = null;
        if (scrollContainer && getComputedStyle(scrollContainer).overflow === 'auto') {
          const allFilterChildren = scrollContainer.querySelectorAll('.filters *');
          let elAboveScrollTop = allFilterChildren[0];
          for (let i = 1; i < allFilterChildren.length; i += 1) {
            if (allFilterChildren[i].offsetTop) {
              // if above fold
              if (allFilterChildren[i].offsetTop < scrollContainer.scrollTop) {
                // if below previously assigned element, assign
                if (allFilterChildren[i].offsetTop > elAboveScrollTop.offsetTop) {
                  elAboveScrollTop = allFilterChildren[i];
                }
              } else {
                break;
              }
            }
          }
          if (elAboveScrollTop.offsetTop === 0) {
            elAboveScrollTop = false;
          } else {
            // determine how to identify this element
            elAboveScrollTopData = {
              selector: '',
              textContent: elAboveScrollTop.textContent,
              extraScrollOffset: scrollContainer.scrollTop - elAboveScrollTop.offsetTop
            };
            const attributeNames = elAboveScrollTop.getAttributeNames();
            for (let i = 0; i < attributeNames.length; i += 1) {
              const attrName = attributeNames[i];
              if (attrName === 'class') {
                Array.from(elAboveScrollTop.classList).filter((a) => a !== 'filter-group__item--disabled').forEach((cl) => {
                  elAboveScrollTopData.selector += `.${cl}`;
                });
              } else {
                elAboveScrollTopData.selector += `[${attrName}="${CSS.escape(elAboveScrollTop.getAttribute(attrName))}"]`;
              }
            }
          }
        }

        // replace contents
        const template = document.createElement('template');
        template.innerHTML = response;
        const newAjaxContainers = template.content.querySelectorAll(refreshContainerSelector);
        newAjaxContainers.forEach((el, index) => {
          ajaxContainers[index].innerHTML = el.innerHTML;
        });

        // init js
        this.initFiltersEtc();

        // after replace
        if (elAboveScrollTopData) {
          this.querySelectorAll(elAboveScrollTopData.selector).forEach((el) => {
            if (el.textContent === elAboveScrollTopData.textContent) {
              scrollContainer.scrollTop = el.offsetTop + elAboveScrollTopData.extraScrollOffset;
            }
          });
        }

        // update mobile count
        if (this.utilBarClone) {
          const from = document.querySelector('.utility-bar:not(.utility-bar--sticky-mobile-copy) .utility-bar__centre');
          const to = this.utilBarClone.querySelector('.utility-bar__centre');
          if (from && to) {
            to.innerHTML = from.innerHTML;
          }
        }

        // remove loading state
        ajaxContainers.forEach((el) => el.classList.remove('ajax-loading'));

        // restore active element
        if (this.activeElementId) {
          const el = document.getElementById(this.activeElementId);
          if (el) {
            el.focus();
          }
        }

        // scroll viewport (must be done after any page size changes)
        const scrollToY = theme.getOffsetTopFromDoc(this.section.querySelector('[data-ajax-scroll-to]')) - document.querySelector('.section-header').clientHeight;
        window.scrollTo({
          top: scrollToY,
          behavior: 'smooth'
        });
      })
      .catch((error) => {
        console.warn(error);
      });
  }
};

window.customElements.define('filter-container', FilterContainer);

/* eslint-disable max-len */
const GalleryViewer = class extends HTMLElement {
  connectedCallback() {
    if (!this.initialised) {
      this.initialised = true;

      // ui
      this.classList.add('gallery-viewer--pre-reveal');
      this.zoomContainer = this.querySelector('.gallery-viewer__zoom-container');
      this.thumbContainer = this.querySelector('.gallery-viewer__thumbs');
      this.controlsContainer = this.querySelector('.gallery-viewer__controls');
      this.previousBtn = this.querySelector('.gallery-viewer__prev');
      this.nextBtn = this.querySelector('.gallery-viewer__next');

      // consts
      this.wheelZoomMultiplier = -0.001;
      this.pinchZoomMultiplier = 0.003;
      this.touchPanModifier = 1.0;

      // vars
      this.currentZoomImage = null;
      this.currentTransform = {
        panX: 0,
        panY: 0,
        zoom: 1
      };
      this.pinchTracking = {
        isTracking: false,
        lastPinchDistance: 0
      };
      this.touchTracking = {
        isTracking: false,
        lastTouchX: 0,
        lastTouchY: 0
      };

      // events
      theme.addDelegateEventListener(this, 'click', '.gallery-viewer__thumb', this.onThumbClick.bind(this));
      this.addEventListener('touchend', this.stopTrackingTouch.bind(this));
      this.addEventListener('touchmove', this.trackInputMovement.bind(this));
      this.addEventListener('mousemove', this.trackInputMovement.bind(this));
      this.addEventListener('wheel', this.trackWheel.bind(this));
      // prevent pan while swiping thumbnails
      this.thumbContainer.addEventListener('touchmove', (evt) => evt.stopPropagation());
      this.previousBtn.addEventListener('click', this.selectPreviousThumb.bind(this));
      this.nextBtn.addEventListener('click', this.selectNextThumb.bind(this));
      this.zoomContainer.addEventListener('click', this.onZoomContainerClick.bind(this));
      new ResizeObserver(() => this.setInitialImagePosition()).observe(this);
    }

    document.documentElement.classList.add('gallery-viewer-open');
    this.addEventListener('keyup', this.handleKeyup.bind(this));
    setTimeout(() => this.classList.remove('gallery-viewer--pre-reveal'), 10);
  }

  // eslint-disable-next-line class-methods-use-this
  disconnectedCallback() {
    document.documentElement.classList.remove('gallery-viewer-open');
  }

  static createEl(type, className, appendTo, innerHTML) {
    const el = document.createElement(type);
    el.className = className;
    if (type === 'a') {
      el.href = '#';
    }
    if (appendTo) {
      appendTo.insertAdjacentElement('beforeend', el);
    }
    if (innerHTML) {
      el.innerHTML = innerHTML;
    }
    return el;
  }

  init(currentFullUrl) {
    this.selectThumb([...this.thumbContainer.children].find((el) => el.dataset.zoomUrl === currentFullUrl) || this.thumbContainer.firstElementChild);
  }

  panZoomImageFromCoordinate(inputX, inputY) {
    // do nothing if the image fits, pan if not
    const doPanX = this.currentZoomImage.clientWidth > this.clientWidth;
    const doPanY = this.currentZoomImage.clientHeight > this.clientHeight;

    if (doPanX || doPanY) {
      const midX = this.clientWidth / 2;
      const midY = this.clientHeight / 2;

      const offsetFromCentreX = inputX - midX;
      const offsetFromCentreY = inputY - midY;

      // the offsetMultipler ensures it can only pan to the edge of the image, no further
      let finalOffsetX = 0;
      let finalOffsetY = 0;

      if (doPanX) {
        const offsetMultiplierX = ((this.currentZoomImage.clientWidth - this.clientWidth) / 2) / midX;
        finalOffsetX = Math.round(-offsetFromCentreX * offsetMultiplierX);
      }
      if (doPanY) {
        const offsetMultiplierY = ((this.currentZoomImage.clientHeight - this.clientHeight) / 2) / midY;
        finalOffsetY = Math.round(-offsetFromCentreY * offsetMultiplierY);
      }

      this.currentTransform.panX = finalOffsetX;
      this.currentTransform.panY = finalOffsetY;
      this.alterCurrentPanBy(0, 0); // sanitise
      this.updateImagePosition();
    }
  }

  alterCurrentPanBy(x, y) {
    this.currentTransform.panX += x;
    // limit offset to keep most of image on screen
    let panXMax = (this.currentZoomImage.naturalWidth * this.currentTransform.zoom - this.clientWidth) / 2.0;
    panXMax = Math.max(panXMax, 0);
    this.currentTransform.panX = Math.min(this.currentTransform.panX, panXMax);
    this.currentTransform.panX = Math.max(this.currentTransform.panX, -panXMax);

    this.currentTransform.panY += y;
    let panYMax = (this.currentZoomImage.naturalHeight * this.currentTransform.zoom - this.clientHeight) / 2.0;
    panYMax = Math.max(panYMax, 0);
    this.currentTransform.panY = Math.min(this.currentTransform.panY, panYMax);
    this.currentTransform.panY = Math.max(this.currentTransform.panY, -panYMax);
    this.updateImagePosition();
  }

  setCurrentTransform(panX, panY, zoom) {
    this.currentTransform.panX = panX;
    this.currentTransform.panY = panY;
    this.currentTransform.zoom = zoom;
    this.alterCurrentTransformZoomBy(0);
  }

  alterCurrentTransformZoomBy(delta) {
    this.currentTransform.zoom += delta;
    // do not zoom out further than fit
    const maxZoomX = this.clientWidth / this.currentZoomImage.naturalWidth;
    const maxZoomY = this.clientHeight / this.currentZoomImage.naturalHeight;
    this.currentTransform.zoom = Math.max(this.currentTransform.zoom, Math.min(maxZoomX, maxZoomY));

    // do not zoom in further than native size
    this.currentTransform.zoom = Math.min(this.currentTransform.zoom, 1.0);

    // reasses pan bounds
    this.alterCurrentPanBy(0, 0);
    this.updateImagePosition();
  }

  setInitialImagePosition() {
    this.currentZoomImage.style.top = `${this.clientHeight / 2 - this.currentZoomImage.clientHeight / 2}px`;
    this.currentZoomImage.style.left = `${this.clientWidth / 2 - this.currentZoomImage.clientWidth / 2}px`;
    this.setCurrentTransform(0, 0, 0); // centre, zoomed out
    this.classList.toggle('gallery-viewer--zoomable', this.currentZoomImage.naturalWidth > this.clientWidth || this.currentZoomImage.naturalHeight > this.clientHeight);
  }

  updateImagePosition() {
    this.currentZoomImage.style.transform = `translate3d(${this.currentTransform.panX}px, ${this.currentTransform.panY}px, 0) scale(${this.currentTransform.zoom})`;
  }

  selectThumb(thumb) {
    [...thumb.parentElement.children].forEach((el) => {
      if (el === thumb) {
        el.classList.add('gallery-viewer__thumb--active');
      } else {
        el.classList.remove('gallery-viewer__thumb--active');
      }
    });

    // replace zoom image
    this.zoomContainer.classList.add('gallery-viewer__zoom-container--loading');
    this.currentZoomImage = GalleryViewer.createEl('img', 'gallery-viewer__zoom-image');
    this.currentZoomImage.alt = '';
    this.currentZoomImage.style.visibility = 'hidden';
    this.currentZoomImage.onload = () => {
      this.zoomContainer.classList.remove('gallery-viewer__zoom-container--loading');
      this.currentZoomImage.style.visibility = '';
      this.setInitialImagePosition();
    };
    this.currentZoomImage.src = thumb.dataset.zoomUrl;
    this.zoomContainer.replaceChildren(this.currentZoomImage);
  }

  selectPreviousThumb(evt) {
    if (evt) evt.preventDefault();
    if (this.thumbContainer.childElementCount < 2) return;

    let previous = this.thumbContainer.querySelector('.gallery-viewer__thumb--active').previousElementSibling;
    while (!previous || !previous.offsetParent) {
      if (!previous) {
        previous = this.thumbContainer.lastElementChild;
      } else {
        previous = previous.previousElementSibling;
      }
    }
    this.selectThumb(previous);
  }

  selectNextThumb(evt) {
    if (evt) evt.preventDefault();
    if (this.thumbContainer.childElementCount < 2) return;

    let next = this.thumbContainer.querySelector('.gallery-viewer__thumb--active').nextElementSibling;
    while (!next || !next.offsetParent) {
      if (!next) {
        next = this.thumbContainer.firstElementChild;
      } else {
        next = next.nextElementSibling;
      }
    }
    this.selectThumb(next);
  }

  stopTrackingTouch() {
    this.pinchTracking.isTracking = false;
    this.touchTracking.isTracking = false;
  }

  trackInputMovement(evt) {
    evt.preventDefault();
    if (evt.type === 'touchmove' && evt.touches.length > 0) {
      // pan
      const touch1 = evt.touches[0];
      if (!this.touchTracking.isTracking) {
        this.touchTracking.isTracking = true;
        this.touchTracking.lastTouchX = touch1.clientX;
        this.touchTracking.lastTouchY = touch1.clientY;
      } else {
        this.alterCurrentPanBy(
          (touch1.clientX - this.touchTracking.lastTouchX) * this.touchPanModifier,
          (touch1.clientY - this.touchTracking.lastTouchY) * this.touchPanModifier
        );
        this.touchTracking.lastTouchX = touch1.clientX;
        this.touchTracking.lastTouchY = touch1.clientY;
      }

      if (evt.touches.length === 2) {
        // pinch
        const touch2 = evt.touches[1];
        const pinchDistance = Math.sqrt((touch1.clientX - touch2.clientX) ** 2 + (touch1.clientY - touch2.clientY) ** 2);
        if (!this.pinchTracking.isTracking) {
          this.pinchTracking.lastPinchDistance = pinchDistance;
          this.pinchTracking.isTracking = true;
        } else {
          const pinchDelta = pinchDistance - this.pinchTracking.lastPinchDistance;
          this.alterCurrentTransformZoomBy(pinchDelta * this.pinchZoomMultiplier);
          this.pinchTracking.lastPinchDistance = pinchDistance;
        }
      } else {
        this.pinchTracking.isTracking = false;
      }
    } else {
      // mousemove
      this.panZoomImageFromCoordinate(evt.clientX, evt.clientY);
    }
  }

  trackWheel(evt) {
    evt.preventDefault();
    if (evt.deltaY !== 0) {
      this.alterCurrentTransformZoomBy(evt.deltaY * this.wheelZoomMultiplier);
    }
  }

  onThumbClick(evt, thumb) {
    evt.preventDefault();
    this.selectThumb(thumb);
  }

  onZoomContainerClick(evt) {
    evt.preventDefault();

    if (this.currentTransform.zoom === 1.0) {
      this.currentTransform.zoom = 0;
      this.alterCurrentTransformZoomBy(0);
    } else {
      this.currentTransform.zoom = 1;
      this.alterCurrentTransformZoomBy(0);
      this.panZoomImageFromCoordinate(evt.clientX, evt.clientY);
    }
  }

  handleKeyup(evt) {
    switch (evt.key) {
      case 'ArrowLeft':
        evt.preventDefault();
        this.selectPreviousThumb();
        break;
      case 'ArrowRight':
        evt.preventDefault();
        this.selectNextThumb();
        break;
    }
  }
};

window.customElements.define('gallery-viewer', GalleryViewer);

const LinkDropdown = class extends HTMLElement {
  constructor() {
    super();

    this.open = false;
    this.button = this.querySelector('.link-dropdown__button');
    this.button.addEventListener('click', this.toggle.bind(this));
  }

  connectedCallback() {
    if (this.open) {
      this.addDismissListener();
    }
  }

  disconnectedCallback() {
    if (this.open) {
      this.removeDismissListener();
    }
  }

  toggle(evt, isDismiss) {
    if (!isDismiss) {
      evt.preventDefault();
      evt.stopPropagation();
    }

    const doExpand = this.button.getAttribute('aria-expanded') === 'false';
    this.button.setAttribute('aria-expanded', doExpand);
    this.button.style.width = `${this.button.clientWidth}px`;

    let newWidth = null;
    const optsBox = this.button.nextElementSibling;
    const isLeftAligned = this.button.closest('.link-dropdown').classList.contains('link-dropdown--left-aligned');
    if (!isLeftAligned) {
      if (doExpand) {
        newWidth = optsBox.clientWidth;
        // rtl - could be either side
        if (document.querySelector('html[dir=rtl]')) {
          newWidth += parseInt(getComputedStyle(optsBox).left, 10);
        } else {
          newWidth += parseInt(getComputedStyle(optsBox).right, 10);
        }
        newWidth -= parseInt(getComputedStyle(optsBox.querySelector('.link-dropdown__link')).paddingInlineStart, 10);
      } else {
        newWidth = parseInt(getComputedStyle(this.button).paddingInlineEnd, 10) + Math.ceil(this.button.querySelector('.link-dropdown__button-text').getBoundingClientRect().width);
      }
      setTimeout(() => {
        this.button.style.width = `${newWidth}px`;
      }, 10);
    }

    if (doExpand) {
      this.open = true;
      this.addDismissListener();
    } else {
      this.open = false;
      this.removeDismissListener();
    }
  }

  addDismissListener() {
    this.dismissCallback = this.toggle.bind(this, true);
    document.addEventListener('click', this.dismissCallback);
  }

  removeDismissListener() {
    document.removeEventListener('click', this.dismissCallback);
    this.dismissCallback = null;
  }
};

window.customElements.define('link-dropdown', LinkDropdown);

/* 
  main-navigation, ProductBlock, 
  media-gallery, product-form, product-inventory, 
  quantity-wrapper, quickbuy, 
  carousel-slider, terms-agreement, etc...
  (all from above code remains unchanged)
*/

/* =====================
   IMAGE COMPARE SECTION
   ===================== */

class ImageCompare extends HTMLElement {
  constructor() {
    super();
    this.el = this;
    this.sectionId = this.dataset.sectionId;
    this.button = this.querySelector('[data-button]');
    this.draggableContainer = this.querySelector('[data-draggable]');
    this.primaryImage = this.querySelector('[data-primary-image]');
    this.secondaryImage = this.querySelector('[data-secondary-image]');

    // Initialize positions
    this.calculateSizes();

    this.active = false;
    this.currentX = 0;
    this.initialX = 0;
    this.xOffset = 0;
    this.buttonOffset = this.button.offsetWidth / 2;

    // Touch events
    this.el.addEventListener('touchstart', this.dragStart.bind(this), false);
    this.el.addEventListener('touchend', this.dragEnd.bind(this), false);
    this.el.addEventListener('touchmove', this.drag.bind(this), false);

    // Mouse events
    this.el.addEventListener('mousedown', this.dragStart.bind(this), false);
    this.el.addEventListener('mouseup', this.dragEnd.bind(this), false);
    this.el.addEventListener('mousemove', this.drag.bind(this), false);

    // On resize
    window.addEventListener('resize', debounce(() => { this.calculateSizes(true); }, 250));

    // In theme editor, re-check sizes if section is reloaded
    document.addEventListener('shopify:section:load', event => {
      if (event.detail.sectionId === this.sectionId) {
        this.calculateSizes();
      }
    });
  }

  calculateSizes(hasResized = false) {
    this.active = false;
    this.currentX = 0;
    this.initialX = 0;
    this.xOffset = 0;

    this.buttonOffset = this.button.offsetWidth / 2;
    this.elWidth = this.el.offsetWidth;

    this.button.style.transform = `translate(-${this.buttonOffset}px, -50%)`;
    this.primaryImage.style.width = `${this.elWidth}px`;

    // If user manually triggers a re-size, set initial drag to half
    if (hasResized) {
      this.draggableContainer.style.width = `${this.elWidth / 2}px`;
    }
  }

  dragStart(e) {
    if (e.type === 'touchstart') {
      this.initialX = e.touches[0].clientX - this.xOffset;
    } else {
      this.initialX = e.clientX - this.xOffset;
    }

    if (e.target === this.button) {
      this.active = true;
    }
  }

  dragEnd(_e) {
    this.initialX = this.currentX;
    this.active = false;
  }

  drag(e) {
    if (this.active) {
      e.preventDefault();
      if (e.type === 'touchmove') {
        this.currentX = e.touches[0].clientX - this.initialX;
      } else {
        this.currentX = e.clientX - this.initialX;
      }
      this.xOffset = this.currentX;
      this.setTranslate(this.currentX, this.button);
    }
  }

  setTranslate(xPos, el) {
    let newXpos = xPos - this.buttonOffset;
    let newVal = (this.elWidth / 2) + xPos;
  
    const boundaryPadding = 50;
    const XposMin = (this.elWidth / 2 + this.buttonOffset) * -1;
    const XposMax = this.elWidth / 2 - this.buttonOffset;
  
    // Keep button from sliding outside boundaries
    if (newXpos < (XposMin + boundaryPadding)) {
      newXpos = XposMin + boundaryPadding;
      newVal = boundaryPadding;
    } else if (newXpos > (XposMax - boundaryPadding)) {
      newXpos = XposMax - boundaryPadding;
      newVal = this.elWidth - boundaryPadding;
    }
  
    // Move the slider button
    el.style.transform = `translate(${newXpos}px, -50%)`;
    // Adjust the width of the primary image container
    this.draggableContainer.style.width = `${newVal}px`;
  }
}

customElements.define('image-compare', ImageCompare);
