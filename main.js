/*
 * Copyright (c) 2012 Glenn Ruehle
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true,  regexp: true, indent: 4, maxerr: 50 */
/*global define, brackets, $, window, PathUtils, Opal */

define(function (require, exports, module) {
    "use strict";

    // Brackets modules
    var AppInit             = brackets.getModule("utils/AppInit"),
        DocumentManager     = brackets.getModule("document/DocumentManager"),
        EditorManager       = brackets.getModule("editor/EditorManager"),
        ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        FileUtils           = brackets.getModule("file/FileUtils"),
        NativeFileSystem    = brackets.getModule("file/NativeFileSystem").NativeFileSystem,
        PanelManager        = brackets.getModule("view/PanelManager"),
        Resizer             = brackets.getModule("utils/Resizer"),
        StringUtils         = brackets.getModule("utils/StringUtils");

    // Local modules
    var panelHTML   = require("text!panel.html");
    require("./asciidoctor.js/dist/opal"),
    require("./asciidoctor.js/dist/asciidoctor");

    // jQuery objects
    var $icon,
        $iframe;

    // Other vars
    var currentDoc,
        panel,
        visible = false,
        realVisibility = false;

    function _loadDoc(doc, preserveScrollPos) {
        if (doc && visible && $iframe) {
            var docText     = doc.getText(),
                scrollPos   = 0,
                bodyText    = "";

            if (preserveScrollPos) {
                scrollPos = $iframe.contents()[0].body.scrollTop;
            }

            // Parse asciidoc into HTML
            bodyText = Opal.Asciidoctor.$render(docText);

            // Remove link hrefs
            bodyText = bodyText.replace(/href=\"([^\"]*)\"/g, "title=\"$1\"");
            bodyText = bodyText.replace(/src=\"[^\"]*\"/g, function (match) {
                return 'src="' + PathUtils.makePathAbsolute(
                    match.substr(match.indexOf('"') + 1 , match.lastIndexOf('"')),
                    doc.file.fullPath
                ) + '"';
            });
            var htmlSource = "<html><head>";
            htmlSource += "<link href='" + require.toUrl("./asciidoc.css") + "' rel='stylesheet'></link>";
            htmlSource += "<link href='" + require.toUrl("./pygment.css") + "' rel='stylesheet'></link>";
            htmlSource += "</head><body onload='document.body.scrollTop=" + scrollPos + "'>";
            htmlSource += bodyText;
            htmlSource += "</body></html>";
            $iframe.attr("srcdoc", htmlSource);
        }
    }

    function _documentChange(e) {
        _loadDoc(e.target, true);
    }

    function _resizeIframe() {
        if (visible && $iframe) {
            var iframeWidth = panel.$panel.innerWidth();
            $iframe.attr("width", iframeWidth + "px");
        }
    }

    function _setPanelVisibility(isVisible) {
        if (isVisible === realVisibility) {
            return;
        }

        realVisibility = isVisible;
        if (isVisible) {
            if (!panel) {
                var $panel = $(panelHTML);
                $iframe = $panel.find("#panel-asciidoc-preview-frame");

                panel = PanelManager.createBottomPanel("asciidoc-preview-panel", $panel);
                $panel.on("panelResizeUpdate", function (e, newSize) {
                    $iframe.attr("height", newSize);
                });
                $iframe.attr("height", $panel.height());

                window.setTimeout(_resizeIframe);
            }
            _loadDoc(DocumentManager.getCurrentDocument());
            $icon.toggleClass("active");
            panel.show();
        } else {
            $icon.toggleClass("active");
            panel.hide();
        }
    }

    function _currentDocChangedHandler() {
        var doc = DocumentManager.getCurrentDocument(),
            ext = doc ? PathUtils.filenameExtension(doc.file.fullPath).toLowerCase() : "";

        if (currentDoc) {
            $(currentDoc).off("change", _documentChange);
            currentDoc = null;
        }

        if (doc && /asc|asciidoc|txt/.test(ext)) {
            currentDoc = doc;
            $(currentDoc).on("change", _documentChange);
            $icon.css({display: "block"});
            _setPanelVisibility(visible);
            _loadDoc(doc);
        } else {
            $icon.css({display: "none"});
            _setPanelVisibility(false);
        }
    }

    function _toggleVisibility() {
        visible = !visible;
        _setPanelVisibility(visible);
    }

    // Insert CSS for this extension
    ExtensionUtils.loadStyleSheet(module, "asciidoc-preview.css");

    // Add toolbar icon
    $icon = $("<a>")
        .attr({
            id: "asciidoc-preview-icon",
            href: "#"
        })
        .css({
            display: "none"
        })
        .click(_toggleVisibility)
        .appendTo($("#main-toolbar .buttons"));

    // Add a document change handler
    $(DocumentManager).on("currentDocumentChange", _currentDocChangedHandler);

    // currentDocumentChange is *not* called for the initial document. Use
    // appReady() to set initial state.
    AppInit.appReady(function () {
        _currentDocChangedHandler();
    });

    // Listen for resize events
    $(PanelManager).on("editorAreaResize", _resizeIframe);
    $("#sidebar").on("panelCollapsed panelExpanded panelResizeUpdate", _resizeIframe);
});