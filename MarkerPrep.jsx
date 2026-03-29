/**========================================================================
 * ?                  MarkerPrep.jsx
 * @author         :  Jason Schwarz (https://hellolovely.tv)
 * @email          :  hello@hellolovely.tv
 * @version        :  1.0.3
 * @createdFor     :  After Effects CC 2022+ (v22+)
 * @description    :  Dockable panel for adding/editing Layer or Comp markers
 *                    at the Current Time Indicator (playhead).
 *
 *                    Behaviour summary:
 *                      - First selected layer          → Add/Edit Layer marker at CTI.
 *                      - No selected layer             → Add/Edit Comp marker at CTI.
 *                      - Marker does not exist         → Creates a new marker from field values.
 *                      - Marker already exists at CTI  → Populates fields with its values, then applies.
 *                    Panel inputs:
 *                      - Comment   : Free-text field.
 *                      - Duration  : HH:MM:SS:FF timecode (blank / 00:00:00:00 = 0 s).
 *                      - 1-frame   : If ticked, a marker with a duration of 0 frames is promoted to 1 frame. Existing spans will be ignored.
 *                      - Label     : Dropdown list of AE's user preference 16 label Colors.
 *========================================================================**/

(function (thisObj) {

    // ─────────────────────────────────────────────────────────────
    // LABEL DATA — sourced from AE preferences + getLabels()
    // ─────────────────────────────────────────────────────────────

    var CP1252_TABLE = {
        161: 161, 162: 162, 163: 163, 164: 164, 165: 165, 166: 166,
        167: 167, 168: 168, 169: 169, 170: 170, 171: 171, 172: 172,
        174: 174, 175: 175, 176: 176, 177: 177, 178: 178, 179: 179,
        180: 180, 181: 181, 182: 182, 183: 183, 184: 184, 185: 185,
        186: 186, 187: 187, 188: 188, 189: 189, 190: 190, 191: 191,
        192: 192, 193: 193, 194: 194, 195: 195, 196: 196, 197: 197,
        198: 198, 199: 199, 200: 200, 201: 201, 202: 202, 203: 203,
        204: 204, 205: 205, 206: 206, 207: 207, 208: 208, 209: 209,
        210: 210, 211: 211, 212: 212, 213: 213, 214: 214, 215: 215,
        216: 216, 217: 217, 218: 218, 219: 219, 220: 220, 221: 221,
        222: 222, 223: 223, 224: 224, 225: 225, 226: 226, 227: 227,
        228: 228, 229: 229, 230: 230, 231: 231, 232: 232, 233: 233,
        234: 234, 235: 235, 236: 236, 237: 237, 238: 238, 239: 239,
        240: 240, 241: 241, 242: 242, 243: 243, 244: 244, 245: 245,
        246: 246, 247: 247, 248: 248, 249: 249, 250: 250, 251: 251,
        252: 252, 253: 253, 254: 254, 255: 255, 338: 140, 339: 156,
        352: 138, 353: 154, 376: 159, 381: 142, 382: 158, 402: 131,
        710: 136, 732: 152, 8211: 150, 8212: 151, 8216: 145, 8217: 146,
        8218: 130, 8220: 147, 8221: 148, 8222: 132, 8224: 134, 8225: 135,
        8226: 149, 8230: 133, 8240: 137, 8249: 139, 8250: 155, 8364: 128,
        8482: 153, 65533: 173,
    };

    function decodePrefBytes(raw, startIndex) {
        if (startIndex === undefined) { startIndex = 0; }
        var result = "";
        for (var j = startIndex; j < raw.length; j++) {
            var code = raw.charCodeAt(j);
            // Remap non-linear CP1252 code points back to byte values.
            if (CP1252_TABLE[code] !== undefined) {
                code = CP1252_TABLE[code];
            }
            var hex = code.toString(16).toUpperCase();
            if (hex.length === 1) { hex = "0" + hex; }
            result += hex;
        }
        return result;
    }

    function hexToAsciiString(hex) {
        var result = "";
        for (var i = 0; i < hex.length; i += 2) {
            result += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
        }
        return result;
    }

    function buildLabelData() {

        // ── Hardcoded defaults — used per-slot when a pref read fails ──
        var DEFAULTS = [
            { value: "",       name: "None"      }, // 0
            { value: "B53838", name: "Red"        }, // 1
            { value: "E4D84C", name: "Yellow"     }, // 2
            { value: "A9CBC7", name: "Aqua"       }, // 3
            { value: "E5BCC9", name: "Pink"       }, // 4
            { value: "A9A9CA", name: "Lavender"   }, // 5
            { value: "E7C19E", name: "Peach"      }, // 6
            { value: "B3C7B3", name: "Sea Foam"   }, // 7
            { value: "677DE0", name: "Blue"       }, // 8
            { value: "4AA44C", name: "Green"      }, // 9
            { value: "8E2C9A", name: "Purple"     }, // 10
            { value: "E8920D", name: "Orange"     }, // 11
            { value: "7F452A", name: "Brown"      }, // 12
            { value: "F46DD6", name: "Fuchsia"    }, // 13
            { value: "3DA2A5", name: "Cyan"       }, // 14
            { value: "A89677", name: "Sandstone"  }, // 15
            { value: "1E401E", name: "Dark Green" }  // 16
        ];

        var prevEncoding = $.appEncoding;
        try {
            $.appEncoding = 'CP1252';

            var colorSection = "Label Preference Color Section 5";
            var textSection  = "Label Preference Text Section 7";
            var prefType     = PREFType.PREF_Type_MACHINE_INDEPENDENT;

            var data = [{ value: "", name: "None" }]; // index 0

            for (var i = 1; i <= 16; i++) {
                var colorKey = "Label Color ID 2 # " + i.toString();
                var textKey  = "Label Text ID 2 # "  + i.toString();

                // ── Color value ──────────────────────────────────────
                var colorHex = DEFAULTS[i].value;
                try {
                    var rawColor = app.preferences.getPrefAsString(
                        colorSection, colorKey, prefType
                    );
                    if (rawColor && rawColor.length > 1) {
                        colorHex = decodePrefBytes(rawColor, 1); // skip AE prefix byte
                    }
                } catch (colorErr) { /* keep default */ }

                // ── Label name ────────────────────────────────────────
                var labelName = DEFAULTS[i].name;
                try {
                    var rawName = app.preferences.getPrefAsString(
                        textSection, textKey, prefType
                    );
                    if (rawName && rawName.length > 1) {
                        var nameHex = decodePrefBytes(rawName, 0); // no prefix byte for text prefs
                        var decoded = hexToAsciiString(nameHex);
                        if (decoded && decoded.length > 0) {
                            labelName = decoded;
                        }
                    }
                } catch (nameErr) { /* keep default */ }

                data.push({ value: colorHex, name: labelName });
            }

            return data;

        } catch (e) {
            return DEFAULTS;
        } finally {
            $.appEncoding = prevEncoding; // always restore
        }
    }

    var LABEL_DATA = buildLabelData();

    var LABEL_NAMES = (function () {
        var names = [];
        for (var i = 0; i < LABEL_DATA.length; i++) {
            names.push(LABEL_DATA[i].name);
        }
        return names;
    }());

    // ─────────────────────────────────────────────────────────────
    // UTILITY HELPERS
    // ─────────────────────────────────────────────────────────────

    /**
     * Zero-pad a number to a given width.
     * @param {number} n
     * @param {number} width
     * @returns {string}
     */
    function zeroPad(n, width) {
        var s = String(Math.floor(Math.abs(n)));
        while (s.length < width) { s = "0" + s; }
        return s;
    }

    /**
     * Check if a frame rate is a common SMPTE drop-frame rate.
     * @param {number} fps
     * @returns {boolean}
     */
    function isDropFrameRate(fps) {
        var rounded = Math.round(fps * 100);
        return (rounded === 2997 || rounded === 5994);
    }

    /**
     * Convert a time in seconds to a HH:MM:SS:FF (or HH:MM:SS;FF) string.
     * Uses SMPTE drop-frame notation when dropFrame is true and fps is a DF rate.
     * @param {number}  seconds
     * @param {number}  fps       - frames per second (always passed from active comp)
     * @param {boolean} dropFrame - true to output drop-frame timecode
     * @returns {string}
     */
    function secondsToTimecode(seconds, fps, dropFrame) {
        if (isNaN(seconds) || seconds < 0) { seconds = 0; }
        if (!fps || fps <= 0) {
            var activeComp = app.project && app.project.activeItem;
            if (!(activeComp instanceof CompItem)) {
                alert("MarkerPrep: No active composition found to determine frame rate.", "MarkerPrep – Error");
                return "00:00:00:00";
            }
            fps = activeComp.frameRate;
        }
        if (dropFrame === undefined) { dropFrame = false; }

        var roundFps    = Math.round(fps);
        var totalFrames = Math.round(seconds * fps);
        var hh, mm, ss, ff, sep;

        if (dropFrame && isDropFrameRate(fps)) {
            // SMPTE drop-frame: 2 frames dropped/min for 29.97, 4 for 59.94
            var D              = Math.round(fps * 0.066666);
            var framesPer10Min = roundFps * 600 - D * 9;
            var framesPerMin   = roundFps * 60  - D;

            var tens      = Math.floor(totalFrames / framesPer10Min);
            var remainder = totalFrames % framesPer10Min;

            var extraMinutes;
            if (remainder < roundFps * 60) {
                extraMinutes = 0;
            } else {
                extraMinutes = Math.floor((remainder - roundFps * 60) / framesPerMin) + 1;
            }

            var totalMinutes = tens * 10 + extraMinutes;
            hh = Math.floor(totalMinutes / 60);
            mm = totalMinutes % 60;

            var remFrames;
            if (extraMinutes === 0) {
                remFrames = remainder;
            } else {
                remFrames = (remainder - roundFps * 60) % framesPerMin + D;
            }

            ss  = Math.floor(remFrames / roundFps);
            ff  = remFrames % roundFps;
            sep = ";";
        } else {
            // Non-drop-frame
            ff = totalFrames % roundFps;
            var totalSecs = Math.floor(totalFrames / roundFps);
            ss = totalSecs % 60;
            var totalMins = Math.floor(totalSecs / 60);
            mm = totalMins % 60;
            hh = Math.floor(totalMins / 60);
            sep = ":";
        }

        return zeroPad(hh, 2) + ":" +
               zeroPad(mm, 2) + ":" +
               zeroPad(ss, 2) + sep +
               zeroPad(ff, 2);
    }

    /**
     * Parse a HH:MM:SS:FF timecode string to seconds.
     * Accepts : (NDF), ; (drop-frame), and . (shorthand for :) as separators.
     * A semicolon before the frames field triggers SMPTE drop-frame compensation.
     * Returns -1 if the string is not valid.
     * @param {string} tc
     * @param {number} fps
     * @returns {number}
     */
    function timecodeToSeconds(tc, fps) {
        if (!fps || fps <= 0) {
            var activeComp = app.project && app.project.activeItem;
            if (!(activeComp instanceof CompItem)) {
                alert("MarkerPrep: No active composition found to determine frame rate.", "MarkerPrep – Error");
                return -1;
            }
            fps = activeComp.frameRate;
        }

        var str = String(tc);
        // Detect drop-frame indicator (semicolon separator)
        var isDrop = str.indexOf(";") !== -1;
        // Normalize all separators (; . :) to colons for parsing
        var clean = str.replace(/[;.]/g, ":");
        var parts = clean.split(":");
        if (parts.length !== 4) { return -1; }

        var hh = parseInt(parts[0], 10);
        var mm = parseInt(parts[1], 10);
        var ss = parseInt(parts[2], 10);
        var ff = parseInt(parts[3], 10);
        if (isNaN(hh) || isNaN(mm) || isNaN(ss) || isNaN(ff)) { return -1; }

        var roundFps = Math.round(fps);
        if (mm > 59 || ss > 59 || ff >= roundFps) { return -1; }

        if (isDrop && isDropFrameRate(fps)) {
            // SMPTE drop-frame compensation
            var D = Math.round(fps * 0.066666);
            var totalMinutes = hh * 60 + mm;
            // Dropped frame numbers are invalid (e.g., 00;00 and 00;01 at non-10th minutes)
            if (ss === 0 && ff < D && (totalMinutes % 10) !== 0) { return -1; }
            var totalFrames = roundFps * (hh * 3600 + mm * 60 + ss) + ff
                            - D * totalMinutes
                            + D * Math.floor(totalMinutes / 10);
            return totalFrames / fps;
        }

        // Non-drop-frame: convert via total frame count for accuracy with non-integer fps
        var totalFrames = roundFps * (hh * 3600 + mm * 60 + ss) + ff;
        return totalFrames / fps;
    }

    /**
     * Round a time value to the nearest frame boundary.
     * @param {number} t   - time in seconds
     * @param {number} fps
     * @returns {number}
     */
    function snapToFrame(t, fps) {
        return Math.round(t * fps) / fps;
    }

    /**
     * Return the duration of one frame in seconds.
     * @param {number} fps
     * @returns {number}
     */
    function oneFrame(fps) {
        return 1 / fps;
    }

    // ─────────────────────────────────────────────────────────────
    // UI DRAWING HELPERS
    // ─────────────────────────────────────────────────────────────

    /**
     * Fill a rounded rectangle using overlapping rects + corner ellipses.
     * Works within ScriptUI's limited path API (no bezier curves).
     * @param {ScriptUIGraphics} g
     * @param {ScriptUIBrush}    brush
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     * @param {number} r  - corner radius
     */
    function fillRoundedRect(g, brush, x, y, w, h, r) {
        if (r > h / 2) { r = Math.floor(h / 2); }
        if (r > w / 2) { r = Math.floor(w / 2); }
        // Vertical centre strip
        g.rectPath(x, y + r, w, h - 2 * r);
        g.fillPath(brush);
        // Horizontal top strip
        g.rectPath(x + r, y, w - 2 * r, r);
        g.fillPath(brush);
        // Horizontal bottom strip
        g.rectPath(x + r, y + h - r, w - 2 * r, r);
        g.fillPath(brush);
        // Four corner quarter-circles
        g.ellipsePath(x, y, 2 * r, 2 * r);
        g.fillPath(brush);
        g.ellipsePath(x + w - 2 * r, y, 2 * r, 2 * r);
        g.fillPath(brush);
        g.ellipsePath(x, y + h - 2 * r, 2 * r, 2 * r);
        g.fillPath(brush);
        g.ellipsePath(x + w - 2 * r, y + h - 2 * r, 2 * r, 2 * r);
        g.fillPath(brush);
    }

    /**
     * Create a flat, rounded-corner button with hover / press visual states.
     * @param {Group}  parent
     * @param {string} text
     * @param {object} opts  - { name, width, height, primary }
     * @returns {Button}
     */
    function createStyledButton(parent, text, opts) {
        if (!opts) { opts = {}; }
        var btn = parent.add("button", undefined, "", { name: opts.name || "" });
        btn.preferredSize = [opts.width || 90, opts.height || 26];
        btn._label   = text;
        btn._hover   = false;
        btn._press   = false;
        btn._primary = opts.primary || false;

        btn.addEventListener("mouseover", function () { btn._hover = true;  btn.notify("onDraw"); });
        btn.addEventListener("mouseout",  function () { btn._hover = false; btn._press = false; btn.notify("onDraw"); });
        btn.addEventListener("mousedown", function () { btn._press = true;  btn.notify("onDraw"); });
        btn.addEventListener("mouseup",   function () { btn._press = false; btn.notify("onDraw"); });

        btn.onDraw = function () {
            var g = this.graphics;
            var w = this.size[0];
            var h = this.size[1];
            var r = 4;
            var bg;

            if (this._primary) {
                bg = this._press  ? [0.16, 0.40, 0.75, 1]
                   : this._hover ? [0.25, 0.55, 0.92, 1]
                   :               [0.22, 0.50, 0.86, 1];
            } else {
                bg = this._press  ? [0.22, 0.22, 0.22, 1]
                   : this._hover ? [0.38, 0.38, 0.38, 1]
                   :               [0.30, 0.30, 0.30, 1];
            }

            fillRoundedRect(g, g.newBrush(g.BrushType.SOLID_COLOR, bg), 0, 0, w, h, r);

            var txtPen = g.newPen(g.PenType.SOLID_COLOR, [1, 1, 1, 1], 1);
            var sz = g.measureString(this._label);
            g.drawString(this._label, txtPen, (w - sz.width) / 2, (h - sz.height) / 2);
        };

        return btn;
    }

    // ─────────────────────────────────────────────────────────────
    // MARKER LOOKUP
    // ─────────────────────────────────────────────────────────────

    function findMarkerAtTime(markerProp, time, fps) {
        var count = markerProp.numKeys;
        var snapped = snapToFrame(time, fps);
        for (var i = 1; i <= count; i++) {
            var keyTime = snapToFrame(markerProp.keyTime(i), fps);
            if (Math.abs(keyTime - snapped) < (0.5 / fps)) {
                return { index: i, marker: markerProp.keyValue(i) };
            }
        }
        return null;
    }

    // ─────────────────────────────────────────────────────────────
    // APPLY MARKER DATA
    // ─────────────────────────────────────────────────────────────

    /**
     * Create a new MarkerValue populated from dialogResult.
     * @param {object} dialogResult
     * @returns {MarkerValue}
     */
    function buildMarkerValue(dialogResult) {
        var mv = new MarkerValue(dialogResult.comment || "");
        mv.duration = dialogResult.durationSecs;
        mv.label    = dialogResult.label;
        return mv;
    }

    /**
     * Write marker to a MarkerValueProperty.
     * Edits in place if existingIndex is provided, otherwise adds a new key.
     *
     * @param {Property} markerProp
     * @param {number}   time           - seconds (CTI)
     * @param {object}   dialogResult
     * @param {number|null} existingIndex - 1-based key index if editing
     */
    function applyMarker(markerProp, time, dialogResult, existingIndex) {
        var mv = buildMarkerValue(dialogResult);

        if (existingIndex !== null && existingIndex !== undefined) {
            // Remove old key and re-add (AE ExtendScript has no
            // direct "set value at existing key" for markers).
            markerProp.removeKey(existingIndex);
        }
        markerProp.setValueAtTime(time, mv);
    }

    // ─────────────────────────────────────────────────────────────
    // EXTRACT EXISTING MARKER DATA
    // ─────────────────────────────────────────────────────────────

    /**
     * Pull editable fields out of an existing MarkerValue.
     * @param {MarkerValue} mv
     * @returns {{ comment: string, durationSecs: number, label: number }}
     */
    function extractMarkerData(mv) {
        return {
            comment      : mv.comment  !== undefined ? mv.comment  : "",
            durationSecs : mv.duration !== undefined ? mv.duration : 0,
            label        : mv.label    !== undefined ? mv.label    : 0
        };
    }

    // ─────────────────────────────────────────────────────────────
    // PANEL BUILDER
    // ─────────────────────────────────────────────────────────────

    function buildUI(thisObj) {

        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "MarkerPrep", undefined, { resizeable: true });

        win.orientation   = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing       = 4;
        win.margins       = [8, 8, 8, 8];

        // ── Comment ──────────────────────────────────────────────
        var commentGrp = win.add("group");
        commentGrp.orientation   = "row";
        commentGrp.alignChildren = ["left", "center"];
        commentGrp.spacing       = 4;

        var commentLabel = commentGrp.add("statictext", undefined, "Comment");
        commentLabel.preferredSize.width = 75;

        var commentField = commentGrp.add("edittext", undefined, "", { multiline: false });
        commentField.preferredSize.width = 120;

        // ── Duration ─────────────────────────────────────────────
        var durGrp = win.add("group");
        durGrp.orientation   = "row";
        durGrp.alignChildren = ["left", "center"];
        durGrp.spacing       = 4;

        var durLabel = durGrp.add("statictext", undefined, "Duration");
        durLabel.preferredSize.width = 75;

        var durationField = durGrp.add("edittext", undefined, "00:00:00:00");
        durationField.preferredSize.width = 120;
        durationField.alignment = ["left", "center"];

        // ── Label color ──────────────────────────────────────────
        var labelGrp = win.add("group");
        labelGrp.orientation   = "row";
        labelGrp.alignChildren = ["left", "center"];
        labelGrp.spacing       = 5;

        var labelLabel = labelGrp.add("statictext", undefined, "Label");
        labelLabel.preferredSize.width = 75;

        // Live color swatch
        var swatch = labelGrp.add("button", undefined, "");
        swatch.preferredSize = [20, 20];

        var labelDD = labelGrp.add("dropdownlist", undefined, LABEL_NAMES);
        labelDD.preferredSize.width = 94;
        labelDD.selection = 0;

        swatch.onDraw = function () {
            var g   = this.graphics;
            var w   = this.size[0];
            var h   = this.size[1];
            var idx = labelDD.selection ? labelDD.selection.index : 0;
            var hex = LABEL_DATA[idx].value;
            // Thin border
            var borderBrush = g.newBrush(g.BrushType.SOLID_COLOR, [0.50, 0.50, 0.50, 1]);
            fillRoundedRect(g, borderBrush, 0, 0, w, h, 3);
            if (hex && hex.length >= 6) {
                var cr = parseInt(hex.substr(0, 2), 16) / 255;
                var cg = parseInt(hex.substr(2, 2), 16) / 255;
                var cb = parseInt(hex.substr(4, 2), 16) / 255;
                fillRoundedRect(g, g.newBrush(g.BrushType.SOLID_COLOR, [cr, cg, cb, 1]), 1, 1, w - 2, h - 2, 2);
            } else {
                fillRoundedRect(g, g.newBrush(g.BrushType.SOLID_COLOR, [0.25, 0.25, 0.25, 1]), 1, 1, w - 2, h - 2, 2);
            }
        };

        // ── 1-frame minimum tickbox ──────────────────────────────
        var oneFrameGrp = win.add("group");
        oneFrameGrp.orientation   = "row";
        oneFrameGrp.alignChildren = ["left", "center"];
        oneFrameGrp.spacing       = 4;

        var oneFrameLabel = oneFrameGrp.add("statictext", undefined, "1-Frame Span");
        oneFrameLabel.preferredSize.width = 75;

        var oneFrameCheck = oneFrameGrp.add("checkbox", undefined, "");
        oneFrameCheck.value = true; // ON by default

        labelDD.onChange = function () {
            swatch.notify("onDraw");
        };

        // ── Buttons ──────────────────────────────────────────────
        var btnGrp = win.add("group");
        btnGrp.orientation   = "row";
        btnGrp.alignment     = ["fill", "bottom"];
        btnGrp.alignChildren = ["left", "center"];
        btnGrp.spacing       = 4;

        var helpBtn = createStyledButton(btnGrp, "?",   { name: "help", width: 26, height: 26 });
        var spacer  = btnGrp.add("group");
        spacer.alignment = ["fill", "center"];
        var getBtn  = createStyledButton(btnGrp, "Get", { name: "get", width: 60, height: 26 });
        var setBtn  = createStyledButton(btnGrp, "Set", { name: "ok",  width: 60, height: 26, primary: true });

        // ── Helper: resolve comp, target, and marker property ────
        function resolveMarkerContext() {
            if (!app.project) {
                alert("No Project is Currently Open.", "MarkerPrep");
                return null;
            }
            var comp = app.project.activeItem;
            if (!(comp instanceof CompItem)) {
                alert(
                    "Please Open and Activate a Composition Before Running MarkerPrep.",
                    "MarkerPrep"
                );
                return null;
            }

            var useLayer    = false;
            var targetLayer = null;
            if (comp.selectedLayers.length > 0) {
                targetLayer = comp.selectedLayers[0];
                useLayer    = true;
            }

            var markerProp;
            try {
                if (useLayer) {
                    markerProp = targetLayer.property("ADBE Marker");
                    if (!markerProp) { throw new Error("Layer has No Marker Property."); }
                } else {
                    markerProp = comp.markerProperty;
                    if (!markerProp) { throw new Error("Comp has No Marker Property."); }
                }
            } catch (e) {
                alert(
                    "Could not access marker property:\n" + e.message,
                    "MarkerPrep \u2013 Error"
                );
                return null;
            }

            return {
                comp       : comp,
                fps        : comp.frameRate,
                cti        : comp.time,
                dropFrame  : comp.dropFrame || false,
                useLayer   : useLayer,
                markerProp : markerProp
            };
        }

        // ── Help button handler ──────────────────────────────────
        helpBtn.onClick = function () {
            alert(
                "MarkerPrep UI  \u2013  Add / Edit Markers at the playhead.\n" +
                "\n" +
                "Target:\n" +
                "  \u2022 Layer Selected  \u2192  Layer marker\n" +
                "  \u2022 No Selection    \u2192  Comp marker\n" +
                "\n" +
                "Get Button:\n" +
                "  \u2022 Reads the marker at the playhead and\n" +
                "    populates the panel fields with its values.\n" +
                "  \u2022 Alerts if no marker exists at the playhead.\n" +
                "\n" +
                "Set Button:\n" +
                "  \u2022 Writes the current field values as a marker\n" +
                "    at the playhead. Overwrites an existing marker\n" +
                "    or creates a new one.\n" +
                "\n" +
                "Duration format:  HH:MM:SS:FF\n" +
                "  Separators:  :   .   ;  (semicolon = drop-frame)\n" +
                "\n" +
                "1-Frame Span:\n" +
                "  When checked, zero-duration markers\n" +
                "  become a 1-frame span.",
                "  Existing spans will be ignored.",
                "MarkerPrep \u2013 Help"
            );
        };

        // ── Get button handler ───────────────────────────────────
        getBtn.onClick = function () {
            var ctx = resolveMarkerContext();
            if (!ctx) { return; }

            var existing = findMarkerAtTime(ctx.markerProp, ctx.cti, ctx.fps);
            if (!existing) {
                alert(
                    "No " + (ctx.useLayer ? "Layer" : "Comp") +
                    " marker found at the current playhead position.",
                    "MarkerPrep"
                );
                return;
            }

            var data = extractMarkerData(existing.marker);
            commentField.text = data.comment;
            if (data.durationSecs > 0) {
                durationField.text = secondsToTimecode(data.durationSecs, ctx.fps, ctx.dropFrame);
            } else {
                durationField.text = "00:00:00:00";
            }
            if (data.label >= 0 && data.label < LABEL_DATA.length) {
                labelDD.selection = data.label;
            }
        };

        // ── Set button handler ───────────────────────────────────
        setBtn.onClick = function () {
            var ctx = resolveMarkerContext();
            if (!ctx) { return; }

            // ── Validate duration ────────────────────────────────
            var tcStr        = durationField.text;
            var durationSecs = 0;

            if (tcStr === "" || tcStr === "00:00:00:00") {
                durationSecs = 0;
            } else {
                durationSecs = timecodeToSeconds(tcStr, ctx.fps);
                if (durationSecs < 0) {
                    alert(
                        "Invalid Duration Timecode.\n" +
                        "Format: HH:MM:SS:FF  ( .  or  ;  as separators)\n" +
                        "Example: 00:00:02:12  or  00.00.02.12",
                        "MarkerPrep \u2013 Input Error"
                    );
                    return;
                }
            }

            // Apply 1-frame minimum if ticked and duration is 0
            if (oneFrameCheck.value && durationSecs === 0) {
                durationSecs = oneFrame(ctx.fps);
            }

            var markerData = {
                comment      : commentField.text,
                durationSecs : durationSecs,
                label        : labelDD.selection ? labelDD.selection.index : 0,
                oneFrameMin  : oneFrameCheck.value
            };

            // ── Check for existing marker at CTI ─────────────────
            var existing = findMarkerAtTime(ctx.markerProp, ctx.cti, ctx.fps);
            var isEdit   = (existing !== null);

            // ── Apply with undo group ────────────────────────────
            var undoLabel = (isEdit ? "Edit " : "Add ") +
                            (ctx.useLayer ? "Layer" : "Comp") + " Marker";

            app.beginUndoGroup(undoLabel);
            try {
                applyMarker(
                    ctx.markerProp,
                    ctx.cti,
                    markerData,
                    isEdit ? existing.index : null
                );
            } catch (e) {
                app.endUndoGroup();
                alert(
                    "Failed to " + (isEdit ? "Edit" : "Add") + " Marker:\n" + e.message,
                    "MarkerPrep \u2013 Error"
                );
                return;
            }
            app.endUndoGroup();
        };

        // ── Resize handling ──────────────────────────────────────
        win.onResizing = win.onResize = function () {
            this.layout.resize();
        };

        // ── Show / Layout ────────────────────────────────────────
        if (win instanceof Window) {
            win.center();
            win.show();
        } else {
            win.layout.layout(true);
            win.layout.resize();
        }
    }

    // ── Run ──────────────────────────────────────────────────────
    buildUI(thisObj);

})(this);
