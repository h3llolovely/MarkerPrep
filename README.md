# MarkerPrep
Make quick changes to AE Comp/Layer marker properties in  After Effects in a small, dockable scriptUI panel.

Add or edit Layer or Comp markers at the Current Time Indicator.

Simplified AE scriplet version [available here](https://github.com/h3llolovely/AE_Scriptlets/blob/main/Utilities/Util_MarkerPrep_PopUp.jsx). For use with kBar, MoBar, AEBar, etc...

MarkerPrep is very useful when paired with [Q-Spans Plus](https://github.com/h3llolovely/Q-Spans) to modify markers for use in render queueing.

----------

**MarkerPrep.jsx**  
- 1.0.3 - Initial release. - Mar 2026

----------
**Usage**
- Move playhead (CTI) to where you want to place a marker.
- Fill in the details.
- Press "Set"  

- Move playhead (CTI) to existing marker. Hold shift to Snap or use "J" or "K" to jump to previous/next marker.
- Press "Get"
- Fill-in/change the details.
- Press "Set" 


**Behaviour summary:**
- First selected layer          → Add/Edit Layer marker at CTI.
- No selected layer             → Add/Edit Comp marker at CTI.
- Marker does not exist         → Creates a new marker from field values.
- Marker already exists at CTI  → Populates fields with its values, then applies.

**Panel inputs:**
- Comment   : Free-text field.
- Duration  : HH:MM:SS:FF drop & non-drop frame timecode. Shorthand allowed. e.g. ".", "," ";" are replaced with ":".
- 1-frame   : If ticked, a marker with a duration of 0 frames is promoted to 1-frame. Existing spans will retain thier duration.
- Label     : Dropdown list of AE's user's preference 16 label Colors.

Screenshots:
---------------
