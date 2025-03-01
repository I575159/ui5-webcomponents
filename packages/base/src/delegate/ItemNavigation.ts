import {
	isDown,
	isUp,
	isLeft,
	isRight,
	isHome,
	isEnd,
	isPageDown,
	isPageUp,
} from "../Keys.js";
import getActiveElement from "../util/getActiveElement.js";

import NavigationMode from "../types/NavigationMode.js";
import ItemNavigationBehavior from "../types/ItemNavigationBehavior.js";

import type UI5Element from "../UI5Element.js";
import { instanceOfUI5Element } from "../UI5Element.js";

interface ITabbable {
	id: string,
	_tabIndex: string,
}

type ItemNavigationOptions = {
	currentIndex?: number,
	navigationMode?: NavigationMode,
	rowSize?: number
	skipItemsSize?: number,
	behavior?: ItemNavigationBehavior,
	getItemsCallback: () => Array<ITabbable>,
	affectedPropertiesNames?: Array<string>,
};

/**
 * The ItemNavigation class manages the calculations to determine the correct "tabindex" for a group of related items inside a root component.
 * Important: ItemNavigation only does the calculations and does not change "tabindex" directly, this is a responsibility of the developer.
 *
 * The keys that trigger ItemNavigation are:
 *  - Up/down
 *  - Left/right
 *  - Home/End
 *
 * Usage:
 * 1) Use the "getItemsCallback" constructor property to pass a callback to ItemNavigation, which, whenever called, will return the list of items to navigate among.
 *
 * Each item passed to ItemNavigation via "getItemsCallback" must be:
 *  - A) either a UI5Element with a "_tabIndex" property
 *  - B) or an Object with "id" and "_tabIndex" properties which represents a part of the root component's shadow DOM.
 *    The "id" must be a valid ID within the shadow root of the component ItemNavigation operates on.
 *    This object must not be a DOM object because, as said, ItemNavigation will not set "tabindex" on it. It must be a representation of a DOM object only
 *    and the developer has the responsibility to update the "tabindex" in the component's DOM.
 *  - C) a combination of the above
 *
 * Whenever the user navigates with the keyboard, ItemNavigation will modify the "_tabIndex" properties of the items.
 * It is the items' responsibilities to re-render themselves and apply the correct value of "tabindex" (i.e. to map the "_tabIndex" ItemNavigation set to them to the "tabindex" property).
 * If the items of the ItemNavigation are UI5Elements themselves, this can happen naturally since they will be invalidated by their "_tabIndex" property.
 * If the items are Objects with "id" and "_tabIndex" however, it is the developer's responsibility to apply these and the easiest way is to have the root component invalidated by ItemNavigation.
 * To do so, set the "affectedPropertiesNames" constructor property to point to one or more of the root component's properties that need refreshing when "_tabIndex" is changed deeply.
 *
 * 2) Call the "setCurrentItem" method of ItemNavigation whenever you want to change the current item.
 * This is most commonly required if the user for example clicks on an item and thus selects it directly.
 * Pass as the only argument to "setCurrentItem" the item that becomes current (must be one of the items, returned by "getItemsCallback").
 *
 * @class
 * @public
 */
class ItemNavigation {
	rootWebComponent: UI5Element;

	_getItems: () => Array<ITabbable>;

	_currentIndex: number;

	_rowSize: number;

	_behavior: ItemNavigationBehavior;

	_navigationMode: NavigationMode;

	_affectedPropertiesNames: Array<string>;

	_skipItemsSize: number | null;

	/**
	 *
	 * @param rootWebComponent the component to operate on (component that slots or contains within its shadow root the items the user navigates among)
	 * @param {ItemNavigationOptions} options Object with configuration options:
	 *  - currentIndex: the index of the item that will be initially selected (from which navigation will begin)
	 *  - navigationMode (Auto|Horizontal|Vertical): whether the items are displayed horizontally (Horizontal), vertically (Vertical) or as a matrix (Auto) meaning the user can navigate in both directions (up/down and left/right)
	 *  - rowSize: tells how many items per row there are when the items are not rendered as a flat list but rather as a matrix. Relevant for navigationMode=Auto
	 * 	- skipItemsSize: tells how many items upon PAGE_UP and PAGE_DOWN should be skipped to applying the focus on the next item
	 *  - behavior (Static|Cycling): tells what to do when trying to navigate beyond the first and last items
	 *    Static means that nothing happens if the user tries to navigate beyond the first/last item.
	 *    Cycling means that when the user navigates beyond the last item they go to the first and vice versa.
	 *  - getItemsCallback: function that, when called, returns an array with all items the user can navigate among
	 *  - affectedPropertiesNames: a list of metadata properties on the root component which, upon user navigation, will be reassigned by address thus causing the root component to invalidate
	 */
	constructor(rootWebComponent: UI5Element, options: ItemNavigationOptions) {
		if (!rootWebComponent.isUI5Element) {
			throw new Error("The root web component must be a UI5 Element instance");
		}

		this.rootWebComponent = rootWebComponent;
		this.rootWebComponent.addEventListener("keydown", this._onkeydown.bind(this));
		this.rootWebComponent._onComponentStateFinalized = () => {
			this._init();
		};

		if (typeof options.getItemsCallback !== "function") {
			throw new Error("getItemsCallback is required");
		}

		this._getItems = options.getItemsCallback;
		this._currentIndex = options.currentIndex || 0;
		this._rowSize = options.rowSize || 1;
		this._behavior = options.behavior || ItemNavigationBehavior.Static;
		this._navigationMode = options.navigationMode || NavigationMode.Auto;
		this._affectedPropertiesNames = options.affectedPropertiesNames || [];
		this._skipItemsSize = options.skipItemsSize || null;
	}

	/**
	 * Call this method to set a new "current" (selected) item in the item navigation
	 * Note: the item passed to this function must be one of the items, returned by the getItemsCallback function
	 *
	 * @public
	 * @param current the new selected item
	 */
	setCurrentItem(current: ITabbable) {
		const currentItemIndex = this._getItems().indexOf(current);

		if (currentItemIndex === -1) {
			console.warn(`The provided item is not managed by ItemNavigation`, current); // eslint-disable-line
			return;
		}

		this._currentIndex = currentItemIndex;
		this._applyTabIndex();
	}

	/**
	 * Call this method to dynamically change the row size
	 *
	 * @public
	 * @param newRowSize
	 */
	setRowSize(newRowSize: number) {
		this._rowSize = newRowSize;
	}

	_init() {
		this._getItems().forEach((item, idx) => {
			item._tabIndex = (idx === this._currentIndex) ? "0" : "-1";
		});
	}

	_onkeydown(event: KeyboardEvent) {
		if (!this._canNavigate()) {
			return;
		}

		const horizontalNavigationOn = this._navigationMode === NavigationMode.Horizontal || this._navigationMode === NavigationMode.Auto;
		const verticalNavigationOn = this._navigationMode === NavigationMode.Vertical || this._navigationMode === NavigationMode.Auto;
		const isRTL = this.rootWebComponent.effectiveDir === "rtl";

		if (isRTL && isLeft(event) && horizontalNavigationOn) {
			this._handleRight();
		} else if (isRTL && isRight(event) && horizontalNavigationOn) {
			this._handleLeft();
		} else if (isLeft(event) && horizontalNavigationOn) {
			this._handleLeft();
		} else if (isRight(event) && horizontalNavigationOn) {
			this._handleRight();
		} else if (isUp(event) && verticalNavigationOn) {
			this._handleUp();
		} else if (isDown(event) && verticalNavigationOn) {
			this._handleDown();
		} else if (isHome(event)) {
			this._handleHome();
		} else if (isEnd(event)) {
			this._handleEnd();
		} else if (isPageUp(event)) {
			this._handlePageUp();
		} else if (isPageDown(event)) {
			this._handlePageDown();
		} else {
			return; // if none of the supported keys is pressed, we don't want to prevent the event or update the item navigation
		}

		event.preventDefault();
		this._applyTabIndex();
		this._focusCurrentItem();
	}

	_handleUp() {
		const itemsLength = this._getItems().length;
		if (this._currentIndex - this._rowSize >= 0) { // no border reached, just decrease the index by a row
			this._currentIndex -= this._rowSize;
			return;
		}

		if (this._behavior === ItemNavigationBehavior.Cyclic) { // if cyclic, go to the **last** item in the **previous** column
			const firstItemInThisColumnIndex = this._currentIndex % this._rowSize;
			const firstItemInPreviousColumnIndex = firstItemInThisColumnIndex === 0 ? this._rowSize - 1 : firstItemInThisColumnIndex - 1; // find the first item in the previous column (if the current column is the first column -> move to the last column)
			const rows = Math.ceil(itemsLength / this._rowSize); // how many rows there are (even if incomplete, f.e. for 14 items and _rowSize=4 -> 4 rows total, although only 2 items on the last row)
			let lastItemInPreviousColumnIndex = firstItemInPreviousColumnIndex + (rows - 1) * this._rowSize; // multiply rows by columns, and add the column's first item's index
			if (lastItemInPreviousColumnIndex > itemsLength - 1) { // for incomplete rows, use the previous row's last item, as for them the last item is missing
				lastItemInPreviousColumnIndex -= this._rowSize;
			}
			this._currentIndex = lastItemInPreviousColumnIndex;
		} else { // not cyclic, so just go to the first item
			this._currentIndex = 0;
		}
	}

	_handleDown() {
		const itemsLength = this._getItems().length;
		if (this._currentIndex + this._rowSize < itemsLength) { // no border reached, just increase the index by a row
			this._currentIndex += this._rowSize;
			return;
		}

		if (this._behavior === ItemNavigationBehavior.Cyclic) { // if cyclic, go to the **first** item in the **next** column
			const firstItemInThisColumnIndex = this._currentIndex % this._rowSize; // find the first item in the current column first
			const firstItemInNextColumnIndex = (firstItemInThisColumnIndex + 1) % this._rowSize; // to get the first item in the next column, just increase the index by 1. The modulo by rows is for the case when we are at the last column
			this._currentIndex = firstItemInNextColumnIndex;
		} else { // not cyclic, so just go to the last item
			this._currentIndex = itemsLength - 1;
		}
	}

	_handleLeft() {
		const itemsLength = this._getItems().length;
		if (this._currentIndex > 0) {
			this._currentIndex -= 1;
			return;
		}

		if (this._behavior === ItemNavigationBehavior.Cyclic) { // go to the first item in the next column
			this._currentIndex = itemsLength - 1;
		}
	}

	_handleRight() {
		const itemsLength = this._getItems().length;
		if (this._currentIndex < itemsLength - 1) {
			this._currentIndex += 1;
			return;
		}

		if (this._behavior === ItemNavigationBehavior.Cyclic) { // go to the first item in the next column
			this._currentIndex = 0;
		}
	}

	_handleHome() {
		const homeEndRange = this._rowSize > 1 ? this._rowSize : this._getItems().length;
		this._currentIndex -= this._currentIndex % homeEndRange;
	}

	_handleEnd() {
		const homeEndRange = this._rowSize > 1 ? this._rowSize : this._getItems().length;
		this._currentIndex += (homeEndRange - 1 - this._currentIndex % homeEndRange); // eslint-disable-line
	}

	_handlePageUp() {
		if (this._rowSize > 1) {
			// eslint-disable-next-line
			// TODO: handle page up on matrix (grid) layout - ColorPalette, ProductSwitch.
			return;
		}
		this._handlePageUpFlat();
	}

	_handlePageDown() {
		if (this._rowSize > 1) {
			// eslint-disable-next-line
			// TODO: handle page up on matrix (grid) layout - ColorPalette, ProductSwitch.
			return;
		}
		this._handlePageDownFlat();
	}

	/**
	 * Handles PAGE_UP in a flat list-like structure, both vertically and horizontally.
	 */
	_handlePageUpFlat() {
		if (this._skipItemsSize === null) {
			// Move the focus to the very top (as Home).
			this._currentIndex -= this._currentIndex;
			return;
		}

		if (this._currentIndex + 1 > this._skipItemsSize) {
			// When there are more than "skipItemsSize" number of items to the top,
			// move the focus up/left with the predefined number.
			this._currentIndex -= this._skipItemsSize;
		} else {
			// Otherwise, move the focus to the very top (as Home).
			this._currentIndex -= this._currentIndex;
		}
	}

	/**
	 * Handles PAGE_DOWN in a flat list-like structure, both vertically and horizontally.
	 */
	_handlePageDownFlat() {
		if (this._skipItemsSize === null) {
			// Move the focus to the very bottom (as End).
			this._currentIndex = this._getItems().length - 1;
			return;
		}

		const currentToEndRange = this._getItems().length - this._currentIndex - 1;

		if (currentToEndRange > this._skipItemsSize) {
			// When there are more than "skipItemsSize" number of items until the bottom,
			// move the focus down/right with the predefined number.
			this._currentIndex += this._skipItemsSize;
		} else {
			// Otherwise, move the focus to the very bottom (as End).
			this._currentIndex = this._getItems().length - 1;
		}
	}

	_applyTabIndex() {
		const items = this._getItems();
		for (let i = 0; i < items.length; i++) {
			items[i]._tabIndex = i === this._currentIndex ? "0" : "-1";
		}

		this._affectedPropertiesNames.forEach(propName => {
			const prop = (this.rootWebComponent as Record<string, any>)[propName];
			(this.rootWebComponent as Record<string, any>)[propName] = Array.isArray(prop) ? [...prop] : { ...prop };
		});
	}

	_focusCurrentItem() {
		const currentItem = this._getCurrentItem();
		if (currentItem) {
			currentItem.focus({ focusVisible: true } as FocusOptions);
		}
	}

	_canNavigate() {
		const currentItem = this._getCurrentItem();
		const activeElement = getActiveElement();

		return currentItem && currentItem === activeElement;
	}

	_getCurrentItem() {
		const items = this._getItems();

		if (!items.length) {
			return;
		}

		// normalize the index
		while (this._currentIndex >= items.length) {
			this._currentIndex -= this._rowSize;
		}

		if (this._currentIndex < 0) {
			this._currentIndex = 0;
		}

		const currentItem = items[this._currentIndex];

		if (!currentItem) {
			return;
		}

		if (instanceOfUI5Element(currentItem)) {
			return currentItem.getFocusDomRef();
		}

		const currentItemDOMRef = this.rootWebComponent.getDomRef();
		if (!currentItemDOMRef) {
			return;
		}

		if (currentItem.id) {
			return currentItemDOMRef.querySelector(`#${currentItem.id}`) as HTMLElement;
		}
	}
}

export default ItemNavigation;

export {
	ITabbable,
};
