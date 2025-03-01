import customElement from "@ui5/webcomponents-base/dist/decorators/customElement.js";
import languageAware from "@ui5/webcomponents-base/dist/decorators/languageAware.js";
import property from "@ui5/webcomponents-base/dist/decorators/property.js";
import Float from "@ui5/webcomponents-base/dist/types/Float.js";
import { getI18nBundle } from "@ui5/webcomponents-base/dist/i18nBundle.js";
import type I18nBundle from "@ui5/webcomponents-base/dist/i18nBundle.js";
import type { I18nText } from "@ui5/webcomponents-base/dist/i18nBundle.js";
import { isEscape } from "@ui5/webcomponents-base/dist/Keys.js";
import SliderBase from "./SliderBase.js";
import Icon from "./Icon.js";

// Template
import SliderTemplate from "./generated/templates/SliderTemplate.lit.js";

// Texts
import {
	SLIDER_ARIA_DESCRIPTION,
	// @ts-ignore
} from "./generated/i18n/i18n-defaults.js";

/**
 * @class
 *
 * <h3 class="comment-api-title">Overview</h3>
 * The Slider component represents a numerical range and a handle (grip).
 * The purpose of the component is to enable visual selection of a value in
 * a continuous numerical range by moving an adjustable handle.
 *
 * <h3>Structure</h3>
 * The most important properties of the Slider are:
 * <ul>
 * <li>min - The minimum value of the slider range.</li>
 * <li>max - The maximum value of the slider range.</li>
 * <li>value - The current value of the slider range.</li>
 * <li>step - Determines the increments in which the slider will move.</li>
 * <li>showTooltip - Determines if a tooltip should be displayed above the handle.</li>
 * <li>showTickmarks - Displays a visual divider between the step values.</li>
 * <li>labelInterval - Labels some or all of the tickmarks with their values.</li>
 * </ul>
 *
 * <h3>Usage</h3>
 * The most common use case is to select values on a continuous numerical scale (e.g. temperature, volume, etc. ).
 *
 * <h3>Responsive Behavior</h3>
 * The <code>ui5-slider</code> component adjusts to the size of its parent container by recalculating and
 * resizing the width of the control. You can move the slider handle in several different ways:
 * <ul>
 * <li>Drag and drop the handle to the desired value.</li>
 * <li>Click/tap on the range bar to move the handle to that location.</li>
 * </ul>
 *
 * <h3>CSS Shadow Parts</h3>
 *
 * <ui5-link target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/CSS/::part">CSS Shadow Parts</ui5-link> allow developers to style elements inside the Shadow DOM.
 * <br>
 * The <code>ui5-slider</code> exposes the following CSS Shadow Parts:
 * <ul>
 * <li>progress-container - Used to style the progress container(the horizontal bar which visually represents the range between the minimum and maximum value) of the <code>ui5-slider</code>.</li>
 * <li>progress-bar - Used to style the progress bar, which shows the progress of the <code>ui5-slider</code>.</li>
 * <li>handle - Used to style the handle of the <code>ui5-slider</code>.</li>
 * </ul>
 *
 * <h3>Keyboard Handling</h3>
 *
 * <ul>
 * <li><code>Left or Down Arrow</code> - Moves the handle one step to the left, effectively decreasing the component's value by <code>step</code> amount;</li>
 * <li><code>Right or Up Arrow</code> - Moves the handle one step to the right, effectively increasing the component's value by <code>step</code> amount;</li>
 * <li><code>Left or Down Arrow + Ctrl/Cmd</code> - Moves the handle to the left with step equal to 1/10th of the entire range, effectively decreasing the component's value by 1/10th of the range;</li>
 * <li><code>Right or Up Arrow + Ctrl/Cmd</code> - Moves the handle to the right with step equal to 1/10th of the entire range, effectively increasing the component's value by 1/10th of the range;</li>
 * <li><code>Plus</code> - Same as <code>Right or Up Arrow</code>;</li>
 * <li><code>Minus</code> - Same as <code>Left or Down Arrow</code>;</li>
 * <li><code>Home</code> - Moves the handle to the beginning of the range;</li>
 * <li><code>End</code> - Moves the handle to the end of the range;</li>
 * <li><code>Page Up</code> - Same as <code>Right or Up + Ctrl/Cmd</code>;</li>
 * <li><code>Page Down</code> - Same as <code>Left or Down + Ctrl/Cmd</code>;</li>
 * <li><code>Escape</code> - Resets the value property after interaction, to the position prior the component's focusing;</li>
 * </ul>
 *
 * <h3>ES6 Module Import</h3>
 *
 * <code>import "@ui5/webcomponents/dist/Slider";</code>
 *
 * @constructor
 * @author SAP SE
 * @alias sap.ui.webc.main.Slider
 * @extends sap.ui.webc.main.SliderBase
 * @tagname ui5-slider
 * @since 1.0.0-rc.11
 * @public
 */
@customElement("ui5-slider")
@languageAware
class Slider extends SliderBase {
	/**
	 * Current value of the slider
	 *
	 * @type {sap.ui.webc.base.types.Float}
	 * @name sap.ui.webc.main.Slider.prototype.value
	 * @defaultvalue 0
	 * @formEvents change input
	 * @formProperty
	 * @public
	 */
	@property({ validator: Float, defaultValue: 0 })
	value!: number;

	_valueInitial?: number;
	_valueOnInteractionStart?: number;
	_progressPercentage = 0;
	_handlePositionFromStart = 0;

	static i18nBundle: I18nBundle;

	static get template() {
		return SliderTemplate;
	}

	constructor() {
		super();
		this._stateStorage.value = undefined;
	}

	static get dependencies() {
		return [Icon];
	}

	/**
	 *
	 * Check if the previously saved state is outdated. That would mean
	 * either it is the initial rendering or that a property has been changed
	 * programmatically - because the previous state is always updated in
	 * the interaction handlers.
	 *
	 * Normalize current properties, update the previously stored state.
	 * Update the visual UI representation of the Slider.
	 *
	 */
	onBeforeRendering() {
		if (!this.isCurrentStateOutdated()) {
			return;
		}

		this.notResized = true;
		this.syncUIAndState();
		this._updateHandleAndProgress(this.value);
	}

	syncUIAndState() {
		// Validate step and update the stored state for the step property.
		if (this.isPropertyUpdated("step")) {
			this._validateStep(this.step);
			this.storePropertyState("step");
		}

		// Recalculate the tickmarks and labels and update the stored state.
		if (this.isPropertyUpdated("min", "max", "value")) {
			this.storePropertyState("min", "max");

			// Here the value props are changed programmatically (not by user interaction)
			// and it won't be "stepified" (rounded to the nearest step). 'Clip' them within
			// min and max bounderies and update the previous state reference.
			this.value = SliderBase.clipValue(this.value, this._effectiveMin, this._effectiveMax);
			this.updateStateStorageAndFireInputEvent("value");
			this.storePropertyState("value");
		}

		// Labels must be updated if any of the min/max/step/labelInterval props are changed
		if (this.labelInterval && this.showTickmarks) {
			this._createLabels();
		}

		// Update the stored state for the labelInterval, if changed
		if (this.isPropertyUpdated("labelInterval")) {
			this.storePropertyState("labelInterval");
		}
	}

	/**
	 * Called when the user starts interacting with the slider
	 *
	 * @private
	 */
	_onmousedown(e: TouchEvent | MouseEvent) {
		// If step is 0 no interaction is available because there is no constant
		// (equal for all user environments) quantitative representation of the value
		if (this.disabled || this.step === 0) {
			return;
		}

		const newValue = this.handleDownBase(e);
		this._valueOnInteractionStart = this.value;

		// Set initial value if one is not set previously on focus in.
		// It will be restored if ESC key is pressed.
		if (this._valueInitial === undefined) {
			this._valueInitial = this.value;
		}

		// Do not yet update the Slider if press is over a handle. It will be updated if the user drags the mouse.
		const ctor = this.constructor as typeof Slider;
		if (!this._isHandlePressed(ctor.getPageXValueFromEvent(e))) {
			this._updateHandleAndProgress(newValue);
			this.value = newValue;
			this.updateStateStorageAndFireInputEvent("value");
		}
	}

	_onfocusin() {
		// Set initial value if one is not set previously on focus in.
		// It will be restored if ESC key is pressed.
		if (this._valueInitial === undefined) {
			this._valueInitial = this.value;
		}

		if (this.showTooltip) {
			this._tooltipVisibility = SliderBase.TOOLTIP_VISIBILITY.VISIBLE;
		}
	}

	_onfocusout() {
		// Prevent focusout when the focus is getting set within the slider internal
		// element (on the handle), before the Slider' customElement itself is finished focusing
		if (this._isFocusing()) {
			this._preventFocusOut();
			return;
		}

		// Reset focus state and the stored Slider's initial
		// value that was saved when it was first focused in
		this._valueInitial = undefined;

		if (this.showTooltip) {
			this._tooltipVisibility = SliderBase.TOOLTIP_VISIBILITY.HIDDEN;
		}
	}

	/**
	 * Called when the user moves the slider
	 *
	 * @private
	 */
	_handleMove(e: TouchEvent | MouseEvent) {
		e.preventDefault();

		// If step is 0 no interaction is available because there is no constant
		// (equal for all user environments) quantitative representation of the value
		if (this.disabled || this._effectiveStep === 0) {
			return;
		}

		const ctor = this.constructor as typeof Slider;
		const newValue = ctor.getValueFromInteraction(e, this._effectiveStep, this._effectiveMin, this._effectiveMax, this.getBoundingClientRect(), this.directionStart);

		this._updateHandleAndProgress(newValue);
		this.value = newValue;
		this.updateStateStorageAndFireInputEvent("value");
	}

	/** Called when the user finish interacting with the slider
	 *
	 * @private
	 */
	_handleUp() {
		if (this._valueOnInteractionStart !== this.value) {
			this.fireEvent("change");
		}

		this.handleUpBase();
		this._valueOnInteractionStart = undefined;
	}

	/** Determines if the press is over the handle
	 *
	 * @private
	 */
	_isHandlePressed(clientX: number) {
		const sliderHandleDomRect = this._sliderHandle.getBoundingClientRect();
		return clientX >= sliderHandleDomRect.left && clientX <= sliderHandleDomRect.right;
	}

	/** Updates the UI representation of the progress bar and handle position
	 *
	 * @private
	 */
	_updateHandleAndProgress(newValue: number) {
		const max = this._effectiveMax;
		const min = this._effectiveMin;

		// The progress (completed) percentage of the slider.
		this._progressPercentage = (newValue - min) / (max - min);
		// How many pixels from the left end of the slider will be the placed the affected  by the user action handle
		this._handlePositionFromStart = this._progressPercentage * 100;
	}

	_handleActionKeyPress(e: KeyboardEvent) {
		const min = this._effectiveMin;
		const max = this._effectiveMax;
		const currentValue = this.value;
		const ctor = this.constructor as typeof Slider;
		const newValue = isEscape(e) ? this._valueInitial : ctor.clipValue(this._handleActionKeyPressBase(e, "value") + currentValue, min, max);

		if (newValue !== currentValue) {
			this._updateHandleAndProgress(newValue!);
			this.value = newValue!;
			this.updateStateStorageAndFireInputEvent("value");
		}
	}

	get styles() {
		return {
			progress: {
				"transform": `scaleX(${this._progressPercentage})`,
				"transform-origin": `${this.directionStart} top`,
			},
			handle: {
				[this.directionStart]: `${this._handlePositionFromStart}%`,
			},
			label: {
				"width": `${this._labelWidth}%`,
			},
			labelContainer: {
				"width": `100%`,
				[this.directionStart]: `-${this._labelWidth / 2}%`,
			},
			tooltip: {
				"visibility": `${this._tooltipVisibility}`,
			},
		};
	}

	get _sliderHandle() {
		return this.shadowRoot!.querySelector(".ui5-slider-handle")!;
	}

	get tooltipValue() {
		const ctor = this.constructor as typeof Slider;
		const stepPrecision = ctor._getDecimalPrecisionOfNumber(this._effectiveStep);
		return this.value.toFixed(stepPrecision);
	}

	get _ariaDisabled() {
		return this.disabled || undefined;
	}

	get _ariaLabelledByText() {
		return Slider.i18nBundle.getText(SLIDER_ARIA_DESCRIPTION as I18nText);
	}

	static async onDefine() {
		Slider.i18nBundle = await getI18nBundle("@ui5/webcomponents");
	}

	get tickmarksObject() {
		const count = this._tickmarksCount;
		const arr = [];

		if (this._hiddenTickmarks) {
			return [true, false];
		}

		for (let i = 0; i <= count; i++) {
			arr.push(this._effectiveMin + (i * this.step) <= this.value);
		}

		return arr;
	}
}

Slider.define();

export default Slider;
