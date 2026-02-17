"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
const GOOGLE_FONT_LINK_ID = 'typing-tracker-google-font';
const CUSTOM_FONT_STYLE_ID = 'typing-tracker-custom-font';
const DEFAULT_SETTINGS = {
    inactivityThreshold: 60000,
    colorMode: 'rgb-animation',
    singleColor: '#FF0000',
    gradientStart: '#FF0000',
    gradientEnd: '#0000FF',
    gradientAnimate: false,
    fontSource: 'default',
    googleFont: 'Roboto Mono',
    customFontUrl: '',
    customFontFamily: ''
};
class TypingTrackerPlugin extends obsidian_1.Plugin {
    constructor() {
        super(...arguments);
        this.timeoutId = null;
        this.timestampEl = null;
        this.pendingEditor = null;
        this.pendingView = null;
    }
    async onload() {
        await this.loadSettings();
        this.applyConfiguredFonts();
        this.registerEvent(this.app.workspace.on('editor-change', (editor) => {
            const view = this.app.workspace.getActiveViewOfType(obsidian_1.MarkdownView);
            if (!view)
                return;
            this.handleTyping(editor, view);
        }));
        this.addSettingTab(new TypingTrackerSettingTab(this.app, this));
    }
    onunload() {
        this.clearInactivityTimer();
        this.pendingEditor = null;
        this.pendingView = null;
        this.removeTimestamp();
        this.removeInjectedFontNodes();
    }
    handleTyping(editor, view) {
        this.pendingEditor = editor;
        this.pendingView = view;
        this.clearInactivityTimer();
        this.removeTimestamp();
        const delay = Number.isFinite(this.settings.inactivityThreshold)
            ? Math.max(250, this.settings.inactivityThreshold)
            : DEFAULT_SETTINGS.inactivityThreshold;
        this.timeoutId = window.setTimeout(() => {
            if (!this.pendingEditor || !this.pendingView)
                return;
            this.showTimestamp(this.pendingEditor, this.pendingView);
        }, delay);
    }
    clearInactivityTimer() {
        if (this.timeoutId !== null) {
            window.clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }
    removeTimestamp() {
        if (this.timestampEl) {
            this.timestampEl.remove();
            this.timestampEl = null;
        }
    }
    showTimestamp(editor, view) {
        if (!view.contentEl.isConnected)
            return;
        const editorEl = view.contentEl.querySelector('.cm-editor');
        if (!editorEl)
            return;
        const stopTime = new Date().toLocaleTimeString();
        this.timestampEl = document.createElement('div');
        this.timestampEl.className = 'typing-tracker-timestamp';
        this.timestampEl.textContent = `Stopped typing at: ${stopTime}`;
        this.updateColors();
        this.updateFonts();
        editorEl.appendChild(this.timestampEl);
        const cursor = editor.getCursor();
        const topOffset = (Math.max(0, cursor.line) * 20) + 40;
        this.timestampEl.style.top = `${topOffset}px`;
    }
    updateColors() {
        if (!this.timestampEl)
            return;
        this.timestampEl.classList.remove('rgb-animation', 'single-color', 'static-gradient', 'animated-gradient');
        this.timestampEl.style.removeProperty('--custom-color');
        this.timestampEl.style.removeProperty('--custom-gradient');
        this.timestampEl.style.removeProperty('--gradient-start');
        this.timestampEl.style.removeProperty('--gradient-end');
        if (this.settings.colorMode === 'rgb-animation') {
            this.timestampEl.classList.add('rgb-animation');
            return;
        }
        if (this.settings.colorMode === 'single') {
            this.timestampEl.classList.add('single-color');
            this.timestampEl.style.setProperty('--custom-color', this.settings.singleColor);
            return;
        }
        if (this.settings.gradientAnimate) {
            this.timestampEl.classList.add('animated-gradient');
            this.timestampEl.style.setProperty('--gradient-start', this.settings.gradientStart);
            this.timestampEl.style.setProperty('--gradient-end', this.settings.gradientEnd);
            return;
        }
        this.timestampEl.classList.add('static-gradient');
        this.timestampEl.style.setProperty('--custom-gradient', `linear-gradient(to right, ${this.settings.gradientStart}, ${this.settings.gradientEnd})`);
    }
    updateFonts() {
        if (!this.timestampEl)
            return;
        switch (this.settings.fontSource) {
            case 'default':
                this.timestampEl.style.fontFamily = '"Roboto Mono", monospace';
                break;
            case 'google':
                this.timestampEl.style.fontFamily = `"${this.settings.googleFont}", monospace`;
                break;
            case 'custom':
                this.timestampEl.style.fontFamily = `"${this.settings.customFontFamily}", monospace`;
                break;
        }
    }
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
    applyConfiguredFonts() {
        if (this.settings.fontSource === 'google') {
            this.loadGoogleFont(this.settings.googleFont);
        }
        else if (this.settings.fontSource === 'custom') {
            this.loadCustomFont();
        }
    }
    loadGoogleFont(fontName) {
        const cleanedName = fontName.trim();
        if (!cleanedName)
            return;
        let linkEl = document.getElementById(GOOGLE_FONT_LINK_ID);
        if (!linkEl) {
            linkEl = document.createElement('link');
            linkEl.id = GOOGLE_FONT_LINK_ID;
            linkEl.rel = 'stylesheet';
            document.head.appendChild(linkEl);
        }
        const encodedFontName = encodeURIComponent(cleanedName);
        linkEl.href = `https://fonts.googleapis.com/css2?family=${encodedFontName}:wght@400;700&display=swap`;
    }
    loadCustomFont() {
        const { customFontUrl, customFontFamily } = this.settings;
        if (!customFontUrl || !customFontFamily)
            return;
        const normalizedUrl = customFontUrl.trim();
        if (!normalizedUrl.startsWith('https://'))
            return;
        let styleEl = document.getElementById(CUSTOM_FONT_STYLE_ID);
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = CUSTOM_FONT_STYLE_ID;
            document.head.appendChild(styleEl);
        }
        const family = this.escapeCssString(customFontFamily.trim());
        const url = this.escapeCssString(normalizedUrl);
        styleEl.textContent = `
            @font-face {
                font-family: '${family}';
                src: url('${url}') format('truetype');
            }
        `;
    }
    removeInjectedFontNodes() {
        var _a, _b;
        (_a = document.getElementById(GOOGLE_FONT_LINK_ID)) === null || _a === void 0 ? void 0 : _a.remove();
        (_b = document.getElementById(CUSTOM_FONT_STYLE_ID)) === null || _b === void 0 ? void 0 : _b.remove();
    }
    escapeCssString(value) {
        return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ');
    }
}
exports.default = TypingTrackerPlugin;
class TypingTrackerSettingTab extends obsidian_1.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Typing Tracker Settings' });
        new obsidian_1.Setting(containerEl)
            .setName('Inactivity threshold')
            .setDesc('Time in seconds before showing stop timestamp')
            .addText(text => text
            .setValue(String(this.plugin.settings.inactivityThreshold / 1000))
            .setPlaceholder('60')
            .onChange(async (value) => {
            const seconds = parseFloat(value);
            if (!Number.isFinite(seconds) || seconds <= 0)
                return;
            this.plugin.settings.inactivityThreshold = seconds * 1000;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName('Color mode')
            .setDesc('Choose how colors are applied')
            .addDropdown(dropdown => dropdown
            .addOption('rgb-animation', 'RGB animation')
            .addOption('gradient', 'Custom gradient')
            .addOption('single', 'Single color')
            .setValue(this.plugin.settings.colorMode)
            .onChange(async (value) => {
            if (value !== 'rgb-animation' && value !== 'gradient' && value !== 'single')
                return;
            this.plugin.settings.colorMode = value;
            await this.plugin.saveSettings();
            this.plugin.updateColors();
            this.display();
        }));
        if (this.plugin.settings.colorMode === 'single') {
            new obsidian_1.Setting(containerEl)
                .setName('Text color')
                .setDesc('Choose a single color')
                .addText(text => text
                .setValue(this.plugin.settings.singleColor)
                .setPlaceholder('#FF0000')
                .onChange(async (value) => {
                this.plugin.settings.singleColor = value;
                await this.plugin.saveSettings();
                this.plugin.updateColors();
            }));
        }
        if (this.plugin.settings.colorMode === 'gradient') {
            new obsidian_1.Setting(containerEl)
                .setName('Gradient start color')
                .setDesc('First color in the gradient')
                .addText(text => text
                .setValue(this.plugin.settings.gradientStart)
                .setPlaceholder('#FF0000')
                .onChange(async (value) => {
                this.plugin.settings.gradientStart = value;
                await this.plugin.saveSettings();
                this.plugin.updateColors();
            }));
            new obsidian_1.Setting(containerEl)
                .setName('Gradient end color')
                .setDesc('Last color in the gradient')
                .addText(text => text
                .setValue(this.plugin.settings.gradientEnd)
                .setPlaceholder('#0000FF')
                .onChange(async (value) => {
                this.plugin.settings.gradientEnd = value;
                await this.plugin.saveSettings();
                this.plugin.updateColors();
            }));
            new obsidian_1.Setting(containerEl)
                .setName('Animate gradient')
                .setDesc('Enable gradient animation')
                .addToggle(toggle => toggle
                .setValue(this.plugin.settings.gradientAnimate)
                .onChange(async (value) => {
                this.plugin.settings.gradientAnimate = value;
                await this.plugin.saveSettings();
                this.plugin.updateColors();
            }));
        }
        new obsidian_1.Setting(containerEl)
            .setName('Font source')
            .setDesc('Choose font source')
            .addDropdown(dropdown => dropdown
            .addOption('default', 'Default (Roboto Mono)')
            .addOption('google', 'Google Fonts')
            .addOption('custom', 'Custom font URL')
            .setValue(this.plugin.settings.fontSource)
            .onChange(async (value) => {
            if (value !== 'default' && value !== 'google' && value !== 'custom')
                return;
            this.plugin.settings.fontSource = value;
            await this.plugin.saveSettings();
            this.plugin.applyConfiguredFonts();
            this.plugin.updateFonts();
            this.display();
        }));
        if (this.plugin.settings.fontSource === 'google') {
            new obsidian_1.Setting(containerEl)
                .setName('Google font name')
                .setDesc('Enter the name of a Google Font')
                .addText(text => text
                .setValue(this.plugin.settings.googleFont)
                .setPlaceholder('Roboto Mono')
                .onChange(async (value) => {
                this.plugin.settings.googleFont = value;
                await this.plugin.saveSettings();
                this.plugin.loadGoogleFont(value);
                this.plugin.updateFonts();
            }));
        }
        if (this.plugin.settings.fontSource === 'custom') {
            new obsidian_1.Setting(containerEl)
                .setName('Custom font URL')
                .setDesc('Enter an HTTPS URL for your custom font')
                .addText(text => text
                .setValue(this.plugin.settings.customFontUrl)
                .setPlaceholder('https://example.com/font.ttf')
                .onChange(async (value) => {
                const trimmedValue = value.trim();
                this.plugin.settings.customFontUrl =
                    trimmedValue && trimmedValue.startsWith('https://') ? trimmedValue : '';
                await this.plugin.saveSettings();
                this.plugin.loadCustomFont();
                this.plugin.updateFonts();
            }));
            new obsidian_1.Setting(containerEl)
                .setName('Custom font family')
                .setDesc('Enter the font-family name to use')
                .addText(text => text
                .setValue(this.plugin.settings.customFontFamily)
                .setPlaceholder('MyCustomFont')
                .onChange(async (value) => {
                this.plugin.settings.customFontFamily = value;
                await this.plugin.saveSettings();
                this.plugin.loadCustomFont();
                this.plugin.updateFonts();
            }));
        }
    }
}
