/**
 * @file Provides an interface between scripts and the RCbenchmark app
 * @name RCbenchmark script API
 * @author Tyto Robotics Inc. <info@tytorobotics.ca>
 * @copyright 2015-2016 Tyto Robotics Inc.
 */
//receive data from GUI
window.addEventListener('message', function(event) {
    switch(event.data.command) {
        case 'init':
            rcb(event);
            break;
        case 'sensorReadCallback':
            if(rcb.vars.callbacks.sensorRead) rcb.vars.callbacks.sensorRead(event.data.content);
            break;
        case 'GUIerror':
            rcb.console.error(event.data.content.message);
            break;
        case 'GUIwarning':
            rcb.console.warning(event.data.content.message);
            break;
        case 'GUImessage':
            rcb.console.print(event.data.content.message);
            break;
        case 'tareLoadCellsComplete':
            if(rcb.vars.callbacks.tareLoadCellsComplete) rcb.vars.callbacks.tareLoadCellsComplete();
            break;
        case 'tareCurrentComplete':
            if(rcb.vars.callbacks.tareCurrentComplete) rcb.vars.callbacks.tareCurrentComplete();
            break;
        case 'updateSystemLimits':
            rcb.vars.systemLimits = event.data.content;
            break;
        case 'ohmUpdate':
            if(rcb.vars.callbacks.ohmRead) rcb.vars.callbacks.ohmRead(event.data.content);
            break;
        case 'newLogEntryCallback':
            if(rcb.vars.callbacks.newLogEntry) rcb.vars.callbacks.newLogEntry();
            break;
        case 'appendTextCallback':
            if(rcb.vars.callbacks.appendTextFile) rcb.vars.callbacks.appendTextFile();
            break;
        case 'stop':
            rcb.console.error('Script stopped by user.');
            rcb.endScript();
            break;
        case 'pollUpdate':
            //called everytime the usb has an update
            if(rcb.vars.callbacks.outputRamp) rcb.vars.callbacks.outputRamp();
            break;
        case 'keyboardPress':
            //called everytime the keyboard is pressed
            if(rcb.vars.callbacks.keyboardPress) rcb.vars.callbacks.keyboardPress(event.data.content);
            break;
        case 'udpReady':
            if(rcb.vars.callbacks.udpInitialized) rcb.vars.callbacks.udpInitialized();
            break;
        case 'udpSent':
            if(rcb.vars.callbacks.udpSent) rcb.vars.callbacks.udpSent();
            break;
        case 'udpReceived':
            if(rcb.vars.callbacks.udpReceived) rcb.vars.callbacks.udpReceived(event.data.content);
            break;
        case 'databasePosted':
            if(rcb.vars.callbacks.databasePosted) rcb.vars.callbacks.databasePosted(event.data.content);
            break;
        // case 'somethingElse':
        //   ...
    }
});

/**
 * Api constructor. Called by the GUI to start the script (do not use in scripts).
 * @param {Object} args - GUI arguments.
 * @constructor
 */
var rcb = function (args) {
    vars = {};
    var cont = args.data.content;
    vars.boardId = cont.config.boardId;
    vars.boardVersion = cont.config.boardVersion;
    vars.s1780detected = cont.config.s1780detected;
    vars.firmwareVersion = cont.config.firmwareVersion;
    vars.controlBoard_flag_active = cont.config.controlBoard_flag_active;
    vars.sourcePage = args.source;
    vars.sourceOrigin = args.origin;
    vars.systemLimits = cont.system;
    vars.userLimits = cont.user;
    vars.output = cont.output;
    vars.sensors = cont.sensors;
    vars.CONTROL_PROTOCOLS = cont.CONTROL_PROTOCOLS;
    vars.printId = 0;
    vars.verbose = true;
    vars.callbacks = {};
    rcb.vars = vars;
    rcb.files.newLogFile.called = false;
    rcb.files.newTextFile.called = false;

    // no default protocol
    rcb.output.set.protocol = undefined;
    //run the script
    rcb.console.print('Started script: ' + cont.name);
    try{
        eval(cont.script); //run user script
    }catch(e){
        rcb.console.error(e.toString()); //error with user script -> show error on user console
    }
};
/**
 * Sends data back to the GUI
 * @private
 * @param {string} command - The command ID of the message being sent.
 * @param {*} [content] - The content to send.
 */
rcb._sendGUIData = function (_command, _content) {
    rcb.vars.sourcePage.postMessage({
        command: _command,
        content: _content
    }, rcb.vars.sourceOrigin);
};
/**
 * Interface function that makes sure callbacks are properly called (with error reporting)
 * @private
 * @param {string} command - The command ID of the message being sent.
 * @param {*} [content] - The content to send.
 */
rcb._callCallback = function (_callback, params) {
    function isFunction(functionToCheck) {
        var getType = {};
        return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
    }

    if(!_callback || !isFunction(_callback)){
        rcb.console.error("Invalid callback function specified");
    }else{
        try{
            _callback(params);
        }catch(e){
            rcb.console.error(e.toString()); //error with user script -> show error on user console
        }
    }
};
/**
 * Console interface functions
 * @class
 */
rcb.console = {
    /**
     * Prints a new line to the user console.
     * @param {string} message - The string to print on the console. Can have html markup.
     * @return {integer} A unique id, to reference this printed line later.
     * @example
     * rcb.console.print('Normal text');
     * rcb.console.print('<strong>Bold font</strong>');
     * rcb.console.print('<span style=\"color: green\">Green text</span>');
     * @example
     * //Simple examples
     * rcb.console.print("I will always be there!");
     * rcb.console.print("I will be gone");
     * rcb.console.remove();
     * rcb.console.append(" Still here!");
     * rcb.console.print("I will be overwritten");
     * rcb.console.overwrite("Fruits:");
     *
     * //Working with ids
     * var id1 = rcb.console.print("I WILL BE REMOVED");
     * var id2 = rcb.console.print("2");
     * var id3 = rcb.console.print("I WILL BE OVERWRITTEN");
     * rcb.console.print("3");
     * rcb.console.append(" apples");
     * rcb.console.append(" oranges", id2);
     * rcb.console.remove(id1);
     * rcb.console.overwrite("Doesn't compare with:", id3);
     * rcb.endScript();
     * @example
     * //Animation example
     * rcb.console.setVerbose(false);
     * var lineQty = 12;
     * var colQty = 25;
     * var lines = [];
     *
     * //Create the lines
     * for(var i=0; i<lineQty; i++) lines[i] = rcb.console.print("");
     *
     * //Starting coordinates
     * var line = 0;
     * var col = 0;
     * var dirL = true;
     * var dirC = true;
     * //Travel loop until user stops script
     * move();
     * function move(){
     *     //Update coordinates
     *     if(dirL){
     *       line++;
     *       if (line === lineQty-1) dirL = false;
     *     }else{
     *       line--;
     *       if (line === 0) dirL = true;
     *     }
     *     if(dirC){
     *       col++;
     *       if (col === colQty-1) dirC = false;
     *     }else{
     *       col--;
     *       if (col === 0) dirC = true;
     *     }
     *
     *     //Draw
     *     for(var i=0; i<lineQty; i++){
     *         if(i===line){
     *             var text = "";
     *             for(var j=0; j<col-1; j++) text+="&nbsp;&nbsp;&nbsp;";
     *             text+="O";
     *             rcb.console.overwrite(text,lines[i]);
     *        }else
     *             rcb.console.overwrite("",lines[i]);
     *     }
     *
     *     //iterate
     *     rcb.wait(move,0.05);
     * }
     */
    print: function (_message) {
        rcb.vars.printId++;
        rcb._sendGUIData("print", {message:_message, id:rcb.vars.printId});
        return rcb.vars.printId;
    },

    /**
     * Adds to the last printed line (does not create a new line).
     * @param {string} message - The string to print on the console. Can have html markup.
     * @param {integer} [id] - If specified, will append to this line instead.
     * @example
     * rcb.console.print('Doing...');
     * rcb.console.append('<strong>done</strong>');
     */
    append: function (message, id) {
        var params={};
        params.message = message;
        params.id = id;
        rcb._sendGUIData("append", params);
    },

    /**
     * Reprints over the last line of the user console. Useful to display progress updates.
     * @param {string} message - The string to print on the console. Can have html markup.
     * @param {integer} [id] - If specified, will overwrite this line instead.
     */
    overwrite: function (message, id) {
        var params={};
        params.message = message;
        params.id = id;
        rcb._sendGUIData("overwrite", params);
    },

    /**
     * Removes the last line of the user console.
     * @param {integer} [id] - If specified, will remove this line instead.
     */
    remove: function (id) {
        rcb._sendGUIData("remove", id);
    },

    /**
     * Prints a message in orange. Does not interrupt script.
     * @param {string} message - The string to print on the console. Can have html markup.
     * @return {integer} A unique id, to reference this printed line later.
     * @example
     * rcb.console.warning('<strong>Warning:</strong> winter is coming!');
     */
    warning: function (message) {
        return rcb.console.print('<span style=\"color: orange\">' + message + '</span>');
    },

    /**
     * Prints an error on the user console. The script will be stopped.
     * @param {string} message - The string to print on the console. Can have html markup.
     * @example
     * rcb.console.print("A basic message");
     * rcb.console.warning("About to throw error");
     * rcb.console.error("Bazinga!");
     */
    error: function (message) {
        rcb._sendGUIData("error", message);
        rcb.endScript();
    },

    /**
     * Clears the script console. Needed for performance reasons if console log has too much text.
     * @example
     * rcb.console.clear();
     */
    clear: function () {
        rcb._sendGUIData("clear");
    },

    /**
     * Prints if verbose mode is active
     * @param {string} message - The string to print on the console. Can have html markup.
     * @return {integer} A unique id, to reference this printed line later.
     * @private
     */
    _verbosePrint: function (message) {
        if(rcb.vars.verbose){
            return rcb.console.print('<span style=\"color: silver\">' + message + '</span>');
        }else{
            return false;
        }
    },

    /**
     * Reprints if verbose mode is active
     * @param {string} message - The string to print on the console. Can have html markup.
     * @param {integer} [id] - If specified, will overwrite this line instead.
     * @private
     */
    _verboseOverwrite: function (message, id) {
        if(rcb.vars.verbose || id) rcb.console.overwrite('<span style=\"color: silver\">' + message + '</span>', id);
    },

    /**
     * Appends if verbose mode is active
     * @param {string} message - The string to print on the console. Can have html markup.
     * @param {integer} [id] - If specified, will append this line instead.
     * @private
     */
    _verboseAppend: function (message, id) {
        if(rcb.vars.verbose || id) rcb.console.append('<span style=\"color: silver\">' + message + '</span>', id);
    },

    /**
     * Removes if verbose mode is active
     * @param {integer} [id] - If specified, will remove this line instead.
     * @private
     */
    _verboseRemove: function (id) {
        if(rcb.vars.verbose || id) rcb.console.remove(id);
    },
    /**
     * Returns the verbose setting
     * @return {boolean}
     * @private
     */
    _isVerbose: function () {
        return(rcb.vars.verbose===true);
    },

    /**
     * Sets the verbose mode for the rcb API. If activated (default), some API functions will print some text (in grey color). It may be useful to deactivate verbose mode in loops to avoid excessive text in the console.
     * @param {boolean} value - If true, verbose mode is activated.
     * @example
     * //Example showing the effect of changing verbose mode
     * rcb.console.print("Verbose activated...");
     * rcb.setDebugMode(true);
     * rcb.setDebugMode(false);
     * rcb.console.setVerbose(false);
     * rcb.console.print("Verbose deactivated...");
     * rcb.setDebugMode(true);
     * rcb.setDebugMode(false);
     * rcb.endScript();
     */
    setVerbose: function (value) {
        rcb.vars.verbose = value;
    }
};
/**
 * Returns the board's unique ID.
 * @return {string} A string representing the board's unique serial number.
 * @example
 * var boardId = rcb.getBoardId();
 * rcb.console.print(boardId);
 * rcb.endScript();
 */
rcb.getBoardId = function () {
    return rcb.vars.boardId;
};
/**
 * Returns the board's hardware version.
 * @return {string} A string representing the board's hardware version.
 */
rcb.getBoardVersion = function () {
    return rcb.vars.boardVersion;
};
/**
 * Returns the board's firmware version.
 * @return {string} A string representing the board's firmware version.
 */
rcb.getFirmwareVersion = function () {
    return rcb.vars.firmwareVersion;
};
/**
 * Finishes the script execution. If this function is not called, the user will have to press the "Stop" button to stop the script.
 */
rcb.endScript = function () {
    rcb.console.print("Script finished");
    clearTimeout(rcb.vars.callbacks.wait);
    vars.callbacks = {};
    rcb._sendGUIData("endScript");
};
/**
 * Activates or deactivates the debug mode.
 * @param {boolean} enable - Set to "true" to activate debug mode, "false" otherwise.
 */
rcb.setDebugMode = function (enable) {
    if(enable){
        rcb.console._verbosePrint("Enabling debug mode");
    }else{
        rcb.console._verbosePrint("Disabling debug mode");
    }
    rcb._sendGUIData("debugModeEnable",enable);
};
/**
 * Callback for the rcb.onKeyboardPress function.
 * @callback keyPressed
 * @param {number} keyValue - The ASCII code of the key that was pressed.
 */
/**
 * Allows for interactive scripts by triggering a special callback when a key is pressed. To use the 'enter' key, make sure the focus is not on the 'stop script' button otherwise the script will stop. The callback you specify will be returned with the ASCII value of the key pressed. For example, spacebar is 32.
 * @param {keyPressed} callback - Function to execute when a key is pressed
 * @example
 * // Example illustrating how to use the onKeyboardPress function
 *
 * rcb.console.print("Listening for keypress...");
 *
 * // Setup keypress callback function
 * rcb.onKeyboardPress(function(key){
 *     // Print on screen which key was pressed
 *     var ascii = String.fromCharCode(key);
 *     rcb.console.print("You pressed " + ascii + " (ASCII " + key + ")");
 * });
 */
rcb.onKeyboardPress = function (callback) {
    //function to execute when keyboard is pressed
    rcb.vars.callbacks.keyboardPress = callback;
}
/**
 * Output control interface functions.
 * @class
 */
rcb.output = {
    /**
     * Sets the control output. The first time calling this function the protocol must be specified to activate the output.
     * @param {string} outputId - "esc", "servo1", "servo2", "servo3", "escA", "escB", "servoA", "servoB". escA, servoA, escB, servoB are for the Series 1780 coaxial channels. For the mono version of Series 1780, use the A side. Can also be an array of multiple outputs eg. ['escA','servoA'].
     * @param {number} value - range depends on the protocol used. Must be an array if the first parameter is also an array. Any value outside the protocol's supported range will turn off the output. See the Utilities tab to learn more about the available control protocols and their respective value ranges.
     * @param {boolean} [protocol] - If using the external RCbenchmark control board you can switch the protocol to one of these: "pwm_50", "pwm_100", "pwm_200", "pwm_300", "pwm_400", "pwm_500", "dshot150", "dshot300", "dshot600", "dshot1200", "multishot", "oneshot42", "oneshot125".
     * @example
     * // Activate the PWM output
     * rcb.output.set("esc", 1000);
     * rcb.wait(callback1, 4);
     *
     * // Setting outside the valid range (700-2300 for pwm) will turn off the output signal
     * function callback1(){
     *     rcb.output.set("esc", 3000);
     *     rcb.wait(callback2, 4);
     * }
     *
     * // You can switch control protocol if using the RCB control board
     * // https://www.rcbenchmark.com/products/series-1580-1585-rc-control-board
     * function callback2(){
     *     rcb.output.set("esc", 0, "dshot150");
     *     rcb.wait(callback3, 4);
     * }
     *
     * function callback3(){
     *     rcb.output.set("esc", 500);
     *     rcb.wait(rcb.endScript, 4);
     * }
     */
    set: function (outputId, value, protocol) {
        if(!rcb.output.set.protocol && !protocol){
            protocol = "pwm_50"; //default
        }
        if(protocol && protocol !== rcb.output.set.protocol){
            if(!rcb.vars.CONTROL_PROTOCOLS[protocol]){
                rcb.console.error("'" + protocol + "' is an unsupported control protocol.");
                return;
            }
            if(protocol !== "pwm_50" && !rcb.vars.controlBoard_flag_active){
                rcb.console.error(protocol + " is only supported by the RCbenchmark control board accessory: https://www.rcbenchmark.com/products/series-1580-1585-rc-control-board");
                return;
            }
            rcb.console._verbosePrint("Setting control protocol to " + protocol);
            rcb._sendGUIData("setControlProtocol", protocol);
            rcb.output.set.protocol = protocol;
        }

        if(value===undefined) console.log.error("Missing value parameter");
        if(Array.isArray(outputId) || Array.isArray(value)){
            //both must be arrays and the same lenght
            if(!(Array.isArray(outputId) && Array.isArray(value)) || (outputId.length !== value.length)){
                rcb.console.error("Both the value and outputId must be arrays and be the same length. Outputs: " + outputId + " (length " + outputId.length + ") value: " + value + " (length " + value.length + ")");
            }
        }else{
            //transform the inputs as arrays
            outputId = [outputId];
            value = [value];
        }
        for(var i = 0; i < outputId.length; i++){
            var protoDef = rcb.vars.CONTROL_PROTOCOLS[rcb.output.set.protocol];
            var activate = false;
            // setting value outside allowed range will deactivate the output
            if(value[i] >= protoDef.min_val && value[i] <= protoDef.max_val)
                activate = true;
            switch (outputId[i].toLowerCase()){
                case "esc":
                    //1580 1520
                    rcb.vars.output.ESC_PWM = value[i];
                    rcb.vars.output.active[0] = activate;
                    //example scripts use esc instead of esca, so they will not work for the Series 1780
                    if(rcb.getBoardVersion() && rcb.getBoardVersion().includes("1780")){
                        rcb.console.warning('For the Series 1780, if you want to control the motor you should use "escA" instead of "esc" in the rcb.output functions. To simultaneously control both escA and escB, specify an array instead ["escA","escB"]. If you use an array you must also specify an array for the PWM values. See RCB API for more info.');
                    }
                    break;
                case "servo1":
                    rcb.vars.output.Servo_PWM[0] = value[i];
                    rcb.vars.output.active[1] = activate;
                    break;
                case "servo2":
                    rcb.vars.output.Servo_PWM[1] = value[i];
                    rcb.vars.output.active[2] = activate;
                    break;
                case "servo3":
                    rcb.vars.output.Servo_PWM[2] = value[i];
                    rcb.vars.output.active[3] = activate;
                    break;
                case "esca":
                    //1780
                    rcb.vars.output.ESCA = value[i];
                    rcb.vars.output.active[0] = activate;
                    break;
                case "servoa":
                    rcb.vars.output.ServoA = value[i];
                    rcb.vars.output.active[1] = activate;
                    break;
                case "escb":
                    rcb.vars.output.ESCB = value[i];
                    rcb.vars.output.active[2] = activate;
                    break;
                case "servob":
                    rcb.vars.output.ServoB = value[i];
                    rcb.vars.output.active[3] = activate;
                    break;
                default:
                    rcb.console.error('"' + outputId[i] + '" is an invalid id (valid: "esc" "servo1" servo2" "servo3", "escA", "escB", "servoA", "servoB").');
                    break;
            }
            rcb._sendGUIData("control",rcb.vars.output);
        }
    },

    // OLD FUNCTION, keep for backward compatibility
    pwm: function(outputId, pulseWidth){
        rcb.output.set(outputId, pulseWidth);
    },

    /**
     * Callback for the rcb.output.ramp function.
     * @callback rampDone
     */
    /**
     * Smoothly ramps up or down the pwm signal. For safety reasons, will only work if the output was previously activated using the rcb.output.set function. To cancel/update a ramp in progress, simply call this function again with new parameters. For example if you want to stop the ramp with the output at 1000us, call:
     rcb.output.ramp("esc", 1000, 1000, 0, null);
     Note that only one control function can be used simultaneously. You must wait for the ramp/steps function to start another.

     * @param {string} outputId - outputId - "esc", "servo1", "servo2", "servo3", "escA", "escB", "servoA", "servoB". escA, servoA, escB, servoB are for the Series 1780 coaxial channels. For the mono version of Series 1780, use the A side. Can also be an array of multiple outputs eg. ['escA','servoA'].
     * @param {number} from - Ramp starting value between 0 and 2300 microseconds. Must be an array if the first parameter is also an array.
     * @param {number} to - Ramp finishing value between 0 and 2300 microseconds. Must be an array if the first parameter is also an array.
     * @param {number} duration - The duration of the ramp in seconds.
     * @param {rampDone} callback - Function to execute when the ramp is finished.
     * @example
     * //Illustrates the use of the ramp function
     * rcb.console.print("Initializing ESC...");
     * rcb.output.set("esc",1000);
     * rcb.wait(callback, 4);
     *
     * function callback(){
     *     var from = 1000;
     *     var to = 1400;
     *     var duration = 15;
     *     var done = rcb.endScript;
     *     rcb.output.ramp("esc", from, to, duration, done);
     * }
     * @example
     * //Same as example above but with multiple outputs simultaneously.
     * rcb.console.print("Initializing ESC...");
     * var outputs = ["escA","escB"];
     * var minVal = [1000,1000];
     * var maxVal = [1400,1300];
     * rcb.output.set(outputs,minVal);
     * rcb.wait(callback, 4);
     *
     * function callback(){
     *     var duration = 15;
     *     var done = rcb.endScript;
     *     rcb.output.ramp(outputs, minVal, maxVal, duration, done);
     * }
     */
    ramp: function (outputId, from, to, duration, callback, updateFct) {
        var startTime = window.performance.now()/1000
        rcb.console._verbosePrint("Ramping " + outputId + " from " + from + " to " + to + " in " + duration + "s.");
        var status = rcb.console._verbosePrint("");

        if(!Array.isArray(outputId)){
            outputId = [outputId];
        }
        if(!Array.isArray(from)){
            from = [from];
        }
        if(!Array.isArray(to)){
            to = [to];
        }
        if(to.length !== from.length){
            rcb.console.error("The from and to inputs must be of the same length in the steps function.");
        }

        //function to execute when sensors are updated
        rcb.vars.callbacks.outputRamp = function(){
            rcb._callCallback(function (){
                currTime = window.performance.now()/1000;
                var outputVal = [];
                var percentage;
                var rampDone = false;
                if(currTime - startTime >= duration){
                    //done with ramp, finish it
                    rcb.vars.callbacks.outputRamp = undefined;
                    outputVal = to;
                    percentage = 1.0;
                    rampDone = true;
                }else{
                    //ramp in progress
                    percentage = (currTime-startTime)/duration;
                    for(var i=0; i<to.length; i++){
                        outputVal[i] = percentage * (to[i]-from[i]) + from[i];
                    }
                }
                //output value
                rcb.output.set(outputId, outputVal);
                rcb.console._verboseOverwrite("&nbsp;&nbsp;&nbsp;&nbsp;ramping " + (100*percentage).toFixed(1) + "%, val " + outputVal, status);
                if(callback && rampDone) callback();
            });
        }

        setTimeout(rcb.vars.callbacks.outputRamp, 0); //if ramp time is zero, we still want one sample loop to still finish.
    },

    /**
     * Callback for the rcb.output.steps function.
     * @callback stepDone
     * @param {boolean} lastStep - Will be true if this is the last step.
     * @param {function} nextStep - Function that you should call when ready to go to the next step.
     */
    /**
     * NOTE: Consider the steps2 function instead, which has a few extra features like a cooldown time. Steps up or down the pwm signal allowing you to perform tasks between each step. For safety reasons, will only work if the output was previously activated using the rcb.output.set function. Note that only one control function can be used simultaneously. You must wait for the steps/ramp function to finish to start another.
     * @param {string} outputId - outputId - "esc", "servo1", "servo2", "servo3", "escA", "escB", "servoA", "servoB". escA, servoA, escB, servoB are for the Series 1780 coaxial channels. For the mono version of Series 1780, use the A side. Can also be an array of multiple outputs eg. ['escA','servoA'].
     * @param {number} from - Steps starting value between 0 and 2300 microseconds. Must be an array if the first parameter is also an array.
     * @param {number} to - Steps finishing value between 0 and 2300 microseconds. Must be an array if the first parameter is also an array.
     * @param {integer} steps - Number of steps to perform.
     * @param {stepDone} [callback] - Function to execute when a step finishes. This function should introduce some sort of delay for the steps function to be effective.
     * @example
     * //Illustrates the use of the steps function
     * rcb.console.print("Initializing ESC...");
     * rcb.output.set("esc",1000);
     * rcb.wait(callback, 4);
     * var sensorPrintId;
     *
     * function callback(){
     *     var from = 1000;
     *     var to = 1400;
     *     var steps = 10;
     *     rcb.output.steps("esc", from, to, steps, stepFct);
     * }
     *
     * //Function called at every step
     * function stepFct(lastStep, nextStepFct){
     *     if(lastStep){
     *         rcb.endScript();
     *     }else{
     *         rcb.console.setVerbose(false);
     *         rcb.wait(function(){ //2 seconds settling time
     *
     *             //Do stuff here... (record to log file, calculate something,  etc...)
     *             rcb.sensors.read(readDone);
     *
     *         }, 2);
     *     }
     *
     *     //Function called when read complete
     *     function readDone(result){
     *         var speed = result.motorElectricalSpeed.displayValue;
     *         var unit = result.motorElectricalSpeed.displayUnit;
     *         if(sensorPrintId === undefined) sensorPrintId = rcb.console.print("");
     *         rcb.console.overwrite("Motor Speed: " + speed + " " + unit, sensorPrintId);
     *
     *         //When done working, go to the next step
     *         rcb.console.setVerbose(true);
     *         nextStepFct();
     *     }
     * }
     */
    steps: function (outputId, from, to, steps, callback) {
        //increment in steps
        rcb.console._verbosePrint("Stepping " + outputId + " from " + from + " to " + to + " in " + steps + " steps.");
        var status = rcb.console._verbosePrint("");
        var currentStep = 0;

        if(!Array.isArray(outputId)){
            outputId = [outputId];
        }
        if(!Array.isArray(from)){
            from = [from];
        }
        if(!Array.isArray(to)){
            to = [to];
        }
        if(to.length !== from.length){
            rcb.console.error("The from and to inputs must be of the same length in the steps function.");
        }

        var step = function(){
            var outputVal = [];
            for(var i=0; i<to.length; i++){
                outputVal[i] = from[i] + (to[i]-from[i])*(currentStep/steps);
            }
            rcb.console._verboseOverwrite("&nbsp;&nbsp;&nbsp;&nbsp;step " + currentStep + " of " + steps + " (val: " + outputVal + ").", status);
            rcb.output.set(outputId, outputVal);
            if(currentStep<steps){
                rcb._callCallback(function(){
                    callback(false, step);
                });
            }else{
                rcb._callCallback(function(){
                    callback(true, function(){rcb.console.warning("No more steps!")});
                });
            }
            currentStep++;
        }
        step();
    },

    /**
     * Callback called at each step of the rcb.output.steps2 function.
     * @stepCallback stepCallback
     * @param {function} nextStep - Function that you should call when ready to go to the next step.
     *
     * @finishedCallback finishedCallback
     */
    /**
     * Compared to the steps function, the steps2 function has built-in cooldown time, settling time, and signal rate limiting. Steps up or down the pwm signal allowing you to perform tasks between each step. For safety reasons, will only work if the output was previously activated using the rcb.output.set function. Note that only one control function can be used simultaneously. You must wait for the steps/ramp function to finish to start another. You can set the "from" value higher than the "to" value, in which case the steps will go downwards. Important: the rate limiting is only between the steps. You should bring the throttle up to the correct throttle yourself and bring it back down yourself external to this function.
     * @param {string} outputId - outputId - "esc", "servo1", "servo2", "servo3", "escA", "escB", "servoA", "servoB". escA, servoA, escB, servoB are for the Series 1780 coaxial channels. For the mono version of Series 1780, use the A side. Can also be an array of multiple outputs eg. ['escA','servoA'].
     * @param {number} from - Steps starting value between 0 and 2300 microseconds. Must be an array if the first parameter is also an array.
     * @param {number} to - Steps finishing value between 0 and 2300 microseconds. Must be an array if the first parameter is also an array.
     * @param {integer} steps - Number of steps to perform.
     * @param {stepCallback} stepCallback - Function to execute when a step finishes. This function should introduce some sort of delay for the steps function to be effective (by calling the nextStep function).
     * @param {finishedCallback} finishedCallback - Function to execute when the steps are all done.
     * @param {Object} [params] - Optional parameters: {steps_qty: default=5, settlingTime_s: default=2, cooldownTime_s: default=0, cooldownThrottle_us: default=from, cooldownMinThrottle: default=0, max_slew_rate_us_per_s: default=100}. Some motors heat up quickly, and may require a cooldown period between steps. You can also optionally specify the throttle at which to cooldown. When activating the cooldown function, the time to complete a test dramatically increases. For this reason the cooldownMinThrottle setting lets the cooldown activate only at high throttle (by default all steps are followed by a cooldown step). Some motors can generate too much torque from step inputs, and some power supplies will not tolerate a motor spinning down quickly. For this reason you can set a rate limit to the throttle signal. Zero disables the rate-limit feature.
     * @example
     * See the sample script called "Sweep - discrete V2" for usage sample.
     */
    steps2: function (outputId, from, to, stepCallback, finishedCallback, params) {
        //increment in steps
        rcb.console._verbosePrint("Stepping " + outputId + " from " + from + " to " + to + ".");
        //var status = rcb.console._verbosePrint("");
        var currentStep = 1;

        if(!Array.isArray(outputId)){
            outputId = [outputId];
        }
        if(!Array.isArray(from)){
            from = [from];
        }
        if(!Array.isArray(to)){
            to = [to];
        }
        if(to.length !== from.length){
            rcb.console.error("The from and to inputs must be of the same length in the steps function.");
        }
        if(params === undefined){
            params = {};
        }
        if(params.cooldownTime_s === undefined){
            params.cooldownTime_s = 0;
        }
        if(params.settlingTime_s === undefined){
            params.settlingTime_s = 2;
        }
        if(params.steps_qty === undefined){
            params.steps_qty = 5;
        }
        if(params.cooldownThrottle_us === undefined){
            params.cooldownThrottle_us = from;
        }
        if(params.cooldownMinThrottle === undefined){
            params.cooldownMinThrottle = 0;
        }
        if(params.max_slew_rate_us_per_s === undefined){
            params.max_slew_rate_us_per_s = 100;
        }
        if(!Array.isArray(params.cooldownThrottle_us)){
            params.cooldownThrottle_us = [params.cooldownThrottle_us];
        }
        if(!Array.isArray(params.max_slew_rate_us_per_s)){
            params.max_slew_rate_us_per_s = [params.max_slew_rate_us_per_s];
        }
        if(to.length !== params.cooldownThrottle_us.length){
            rcb.console.error("The cooldownThrottle_us array must be the same lenght as the 'from' array");
        }
        if(to.length !== params.max_slew_rate_us_per_s.length){
            rcb.console.error("The max_slew_rate_us_per_s array must be the same lenght as the 'from' array");
        }
        if(params.steps_qty<=0){
            rcb.console.error("Minimum steps is 1");
        }

        var previousValues = from;

        var settle = function(){
            rcb._callCallback(function(){
                if(params.settlingTime_s > 0){
                    rcb.console._verbosePrint("Settling " + params.settlingTime_s + " seconds...");
                }
                setTimeout(function(){
                    stepCallback(step);
                }, params.settlingTime_s*1000);
            });
            currentStep++;
        }

        var cooldown = function(){
            rcb.console._verbosePrint("Cooling down for " + params.cooldownTime_s + " seconds...");
            setTimeout(gotoStep, params.cooldownTime_s*1000);
        }

        // calculates how fast to change the throttle in order to respect the rate limit parameter
        var calcRateLimit = function(to){
            var from = previousValues;
            var rate = params.max_slew_rate_us_per_s;
            if(rate <= 0){
                return 0;
            }
            var time = 0;
            for(var i=0; i<to.length; i++){
                var us = math.abs(to[i]-from[i]);
                time = math.max(time, us/rate);
            }
            return time;
        }

        var finish = function(){
            rcb._callCallback(finishedCallback);
        }

        var gotoStep = function(){
            if(currentStep <= params.steps_qty){
                var outputVal = [];
                for(var i=0; i<to.length; i++){
                    if(params.steps_qty === 1){
                        outputVal[i] = to[i];
                    }else{
                        outputVal[i] = from[i] + (to[i]-from[i])*((currentStep-1)/(params.steps_qty-1));
                    }
                }
                rcb.console._verbosePrint("Starting step " + currentStep + " of " + params.steps_qty + " (val: " + outputVal + ").");
                rcb.output.ramp(outputId, previousValues, outputVal, calcRateLimit(outputVal), settle);
                previousValues = outputVal;
            }else{
                finish();
                previousValues = to;
            }
        }

        var step = function(){
            if(params.cooldownTime_s > 0 && currentStep > 0 && currentStep <= params.steps_qty && previousValues >= params.cooldownMinThrottle){
                var cool = params.cooldownThrottle_us;
                rcb.output.ramp(outputId, previousValues, cool, calcRateLimit(cool), cooldown);
                previousValues = cool;
            }else{
                gotoStep();
            }
        }
        step();
    },
};
/**
 * Sensor interface functions.
 * @class
 */
rcb.sensors = {
    /**
     * Callback for the readSensors function when readings are ready.
     * @callback readSensorsReady
     * @param {Object} results - Averaged reading results
     * @param {function} results.print - Prints the content of the results structure
     */

    /**
     * Gets new sensor readings. Automatically averages a few readings for reducing noise. IMPORTANT: use the result.print() function to see the structure of the result variable. This structure will vary depending on the hardware (1520 or 1580), if there are accessories connected, or if debug mode is active. See the example below for using the print() function. Note: each entry has 'working' and 'display' sections. 'working' will always remain the same, while 'display' will follow the user's display unit preferences. Use 'display' if reporting to the user, and use 'working' if performing calculations.
     * @param {readSensorsReady} callback - The function to execute when readings are ready.
     * @param {integer} [averageQty=5] - The number of samples to average before returning the result.
     * @example
     * //This sample script prints the content of the structure
     * //returned by the rcb.sensors.read callback
     * rcb.sensors.read(callback);
     *
     * function callback(result){
     *     //print structure content
     *     result.print();
     *     rcb.endScript();
     * }
     * @example
     * //Read 10 samples averaged, and print thrust on screen
     * rcb.sensors.read(callback,10);
     *
     * function callback(result){
     *    var thrust = result.thrust.displayValue;
     *    var unit = result.thrust.displayUnit;
     *    rcb.console.print("Thrust: " + thrust.toPrecision(3) + " " + unit);
     *    rcb.endScript();
     * }
     */
    read: function (callback,averageQty) {
        if(averageQty===undefined) averageQty = 5;
        var status = rcb.console._verbosePrint("Reading and averaging next " + averageQty + " readings...");
        rcb.vars.callbacks.sensorRead = function(result){
            rcb.console._verboseAppend("done", status);
            //append the print function to the structure
            result.print = function(){
                //help with struct
                rcb.console.warning("Note: each entry has 'working' and 'display' sections. 'working' will always remain the same, while 'display' will follow the user's display unit preferences. Use 'display' if reporting to the user, and use 'working' if performing calculations.");

                //print structure content
                for (var key in result) {
                    if(key!="print"){
                        rcb.console.print('result.'+key);
                        for (var subkey in result[key]) {
                            rcb.console.print('&nbsp;&nbsp;&nbsp;&nbsp;.' + subkey+' = '+result[key][subkey]);
                        }
                        rcb.console.print('');
                    }
                }
            }
            rcb._callCallback(callback, result);
        };
        rcb._sendGUIData("sensorsRead",averageQty);
    },

    /**
     * Callback for the readOhm function when reading is ready.
     * @callback readOhmReady
     * @param {number} result - Ohmmeter reading. If NaN means value is out of measurement range.
     */

    /**
     * Reads the ohmmeter. If verbose mode is active, the reading will be displayed on the console.
     * @param {readOhmReady} [callback] - The function to execute when the reading is ready.
     * @example
     * //Gets the ohmmeter reading
     * rcb.sensors.readOhm(callback);
     *
     * function callback(reading){
     *     rcb.console.print("Ohm reading: " + reading.toPrecision(4));
     *     rcb.endScript();
     * }
     */
    readOhm: function (callback) {
        var status = rcb.console._verbosePrint('Reading ohmmeter...');
        rcb.vars.callbacks.ohmRead = function(val){
            rcb.console._verboseAppend(val.toPrecision(4), status);
            if(callback){
                rcb._callCallback(callback, val);
            }
        };
        rcb._sendGUIData("readOhm","");
    },
    /**
     * Callback for the tareLoadCells function when tare is complete.
     * @callback tareLoadCellsComplete
     */

    /**
     * Performs a tare function on the load cells.
     * @param {tareLoadCellsComplete} [callback] - The function to execute when the tare is complete.
     * @example
     * //Simple script that only tares the load cells and finishes when tare is complete.
     * rcb.sensors.tareLoadCells(rcb.endScript);
     */
    tareLoadCells: function (callback) {
        var status = rcb.console._verbosePrint('Load cells tare in progress...');
        rcb.vars.callbacks.tareLoadCellsComplete = function(){
            rcb.console._verboseAppend(' done', status);
            if(callback){
                rcb._callCallback(callback);
            }
        };
        rcb._sendGUIData("tareLoadCells","");
    },

    /**
     * Callback for the tareCurrent function when tare is complete.
     * @callback tareCurrentComplete
     */

    /**
     * Performs a tare function on the current sensor (helps overcome Hall effect hysteresis). Only supported on Hall effect current sensors, such as the ones used in the Series 1780. If trying to tare the current on other proucts, this function will have no effect other than calling the specified callback.
     * @param {tareCurrentComplete} [callback] - The function to execute when the tare is complete.
     * @example
     * //Simple script that only tares the current and finishes when tare is complete.
     * rcb.sensors.tareLoadCells(rcb.endScript);
     */
    tareCurrent: function (callback) {
        if(rcb.getBoardVersion() === "Series 1780"){
            var status = rcb.console._verbosePrint('Current tare in progress...');
            rcb.vars.callbacks.tareCurrentComplete = function(){
                rcb.console._verboseAppend(' done', status);
                if(callback){
                    rcb._callCallback(callback);
                }
            };
            rcb._sendGUIData("tareCurrent","");
        }else{
            if(callback) callback();
        }
    },

    /**
     * Changes the safety limit for a sensor. Units are internal working units (A, V, RPM, g, and N·m) regardless of the user display units. It is not possible to set limits beyond hardware limits (values will automatically be trimmed).
     * @param {string} sensorId - "current", "voltage", "rpm", "thrust", or "torque".
     * @param {number} min - Minimum sensor value before cutoff activates.
     * @param {number} max - Maximum sensor value before cutoff activates.
     * @example
     * rcb.sensors.setSafetyLimit("current",10,20);
     * //rcb.endScript -> the safety cutoff will prevent motor from spinning
     */
    setSafetyLimit: function (sensorId, min, max) {
        setTimeout(function(){ //Timout required to ensure the number of poles propagates the updated system limits...
            var id = sensorId.toLowerCase();
            var capitalized = id.charAt(0).toUpperCase() + id.substring(1);
            //var minSystem = rcb.vars.systemLimits[sensorId+'Min'];
            //var maxSystem = rcb.vars.systemLimits[sensorId+'Max'];

            if(id==="current" || id==="voltage" || id==="rpm" || id==="thrust" || id==="torque"){
                if(min<max){
                    if(true){//min >= minSystem && max <= maxSystem){
                        rcb.vars.userLimits[sensorId+'Min'] = min;
                        rcb.vars.userLimits[sensorId+'Max'] = max;
                        rcb.console._verbosePrint(capitalized + ' limits set to ['+min+' - '+max+']');
                        rcb._sendGUIData("changeSafetyLimits",rcb.vars.userLimits);
                    } else rcb.console.error(capitalized + ': ['+min+' - '+max+'] values exceed system limits ['+minSystem+' - '+maxSystem+']');
                }else rcb.console.error('Invalid safety limits input range ['+min+' - '+max+']');
            }else{
                rcb.console.error('Unrecognized sensorId: ' + sensorId + '. Accepted values are "current", "voltage", "rpm", "thrust", "torque".');
            }
        },20);
    },

    /**
     * Changes the number of motor poles. The correct number of poles is required to obtain a correct rpm reading.
     * @param {integer} numberOfPoles - The motor number of poles. Must be an multiple of 2.
     * @example
     * rcb.sensors.setMotorPoles(6);
     */
    setMotorPoles: function (numberOfPoles) {
        if(numberOfPoles>0 && numberOfPoles%2===0){
            rcb.console._verbosePrint('Setting motor poles to ' + numberOfPoles);
            rcb._sendGUIData("setPoles",numberOfPoles);
        }else
            rcb.console.error("Invalid number of poles: " + numberOfPoles);
    },

    /**
     * Helper function that averages an array of 'results'. Must be an array of 'results', where 'results' is obtained from the read function.
     * @param {array} resultsArray - An array holding multiple results
     * @return {object} A single averaged results object structure. See the read function for more details on this object.
     */
    averageResultsArray: function(results) {
        function isNumber(n) {
            return !isNaN(parseFloat(n)) && isFinite(n);
        }
        var average = {};
        results.forEach(function(res){
            for(var key in res){
                if(key!=='print'){
                    if(!average[key]){
                        average[key] = {
                            displayUnit: res[key].displayUnit,
                            workingUnit: res[key].workingUnit,
                            displayValue: res[key].displayValue,
                            workingValue: res[key].workingValue
                        };
                    }else{
                        if(isNumber(res[key].displayValue)){
                            average[key].displayValue += res[key].displayValue;
                        }
                        if(isNumber(res[key].workingValue)){
                            average[key].workingValue += res[key].workingValue;
                        }
                    }
                }
            }
        });
        for(var key in average){
            if(isNumber( average[key].workingValue )){
                average[key].workingValue = average[key].workingValue / results.length;
            }
            if(isNumber( average[key].displayValue )){
                average[key].displayValue = average[key].displayValue / results.length;
            }
        }
        // restore the print function
        average.print = function(){
            rcb.console.warning("Print function not available with the average results array. Not yet implemented, contact us at support@rcbenchmark.com if you need to use this function.");
        };
        return average;
    },

    /**
     * Allows to completely disable safety limits (dangerous function).
     * @private
     * @param {boolean} enable - Set to "false" to disable safety limit check.
     */
    _setSafetyEnable: function (enable) {
        if(!enable){
            rcb.console.warning("Warning: disabling safety cutoffs!");
        }else{
            rcb.console._verbosePrint('Safety cutoffs enabled.');
        }
        rcb._sendGUIData("safetyCutoffDisable",!enable);
    }
};
/**
 * Callback for the wait function.
 * @callback waitDone
 */
/**
 * Waits a certain number of seconds before executing the callback function. Note that calling this function again will cancel a previous wait. Use the javascript setTimeout function if you need multiple delays in parallel.
 * @param {waitDone} callback - The function to execute after the delay is over.
 * @param {number} delay - Wait delay in seconds (can be floating numbers like 0.1 for 100ms).
 * @example
 * //Illustrates the use of the wait and overwrite functions
 * rcb.console.print("LEGEND...");
 * rcb.console.setVerbose(false);
 * rcb.wait(callback1, 2);
 *
 * function callback1(){
 *     rcb.console.overwrite("LEGEND... wait for it...");
 *     rcb.wait(callback2, 2);
 * }
 *
 * function callback2(){
 *     rcb.console.overwrite("LEGEND... wait for it... DARY!");
 *     rcb.wait(callback3, 1.5);
 * }
 *
 * function callback3(){
 *     rcb.console.overwrite("LEGENDARY!");
 *     rcb.endScript();
 * }
 */
rcb.wait = function (callback,delay) {
    var s = "s";
    if(delay===1) s = "";
    if(delay === undefined || delay === null || delay<0 || delay === NaN || !Number(delay)){
        rcb.console.error("Invalid delay parameter for the rcb.wait function");
        return;
    }
    var status = rcb.console._verbosePrint("Waiting " + delay + " second" + s + "...");
    clearTimeout(rcb.vars.callbacks.wait);
    rcb.vars.callbacks.wait = setTimeout(function(){
        rcb.console._verboseAppend("done", status);
        rcb._callCallback(callback);
    }, delay*1000);
};
/**
 * File interface functions
 * @class
 */
rcb.files = {
    /**
     * Creates a new file for logging (in the user's working directory). Generates an error if user's working directory is not set.
     * @param {Object} [params] - parameters for file creation.
     * @param {string} [params.prefix="Auto"] - A prefix to append in front of the file.
     * @param {Array.<string>} [params.additionalHeaders] - Additional header(s) in addition to the standard headers.
     * @example
     * //Example script recording 5 rows in a loop
     * var numberOflines = 5;
     *
     * //Create a new log
     * rcb.files.newLogFile({prefix: "Example1"});
     *
     * //Start the sequence
     * readSensor();
     *
     * function readSensor(){
     *     if(numberOflines>0){
     *         rcb.sensors.read(readDone);
     *         numberOflines--;
     *     }else
     *         rcb.endScript();
     * }
     *
     * function readDone(result){
     *     rcb.files.newLogEntry(result,readSensor);
     * }
     * @example
     * //Example recording with extra data
     * var numberOfLines = 5;
     *
     * //Create a new log
     * var add = ["Remaining", "Line"];
     * rcb.files.newLogFile({prefix: "Example2", additionalHeaders: add});
     *
     * //Start the sequence
     * readSensor();
     *
     * function readSensor(){
     *     if(numberOfLines>0){
     *         rcb.sensors.read(readDone);
     *         numberOfLines--;
     *     }else
     *         rcb.endScript();
     * }
     *
     * function readDone(result){
     *     var add = [numberOfLines, 5-numberOfLines];
     *     rcb.files.newLogEntry(result,readSensor,add);
     * }
     * @example
     * //This example continuously records data at full
     * //speed until the user stops the script
     *
     * //Create a new log
     * rcb.files.newLogFile({prefix: "Continuous"});
     *
     * //Start the sequence
     * readSensor();
     *
     * function readSensor(){
     *     rcb.sensors.read(saveResult,10);
     * }
     *
     * function saveResult(result){
     *     rcb.files.newLogEntry(result, readSensor);
     * }
     */
    newLogFile: function (params) {
        if(params===undefined) params={};
        if(params.prefix===undefined) params.prefix = "Auto";
        rcb._sendGUIData("newLogFile",params);
        rcb.files.newLogFile.called = true;
        rcb.files.newTextFile.called = false;
        rcb.console._verbosePrint('Creating new log file with "' + params.prefix + '" prefix in working directory');
    },

    /**
     * Callback for the newLogEntry function when finished writing to file.
     * @callback newLogSaved
     */

    /**
     * Records a new entry to the created log file. Generates an error if the function newLogFile was never called.
     * @param {Object} readings - Sensor readings as returned by the readSensors function.
     * @param {newLogSaved} [callback] - The function to execute when recording is done.
     * @param {Array.<number|string>} [additionalValues] - Additional values to append to the entry.
     */
    newLogEntry: function (readings,callback,additionalValues) {
        var restorePrint = readings.print;
        delete readings.print;
        if(!rcb.files.newLogFile.called) rcb.console.error("newLogFile function must be called before calling the newLogEntry function");
        else{
            var status = rcb.console._verbosePrint("Saving new log entry...");
            rcb.vars.callbacks.newLogEntry = function(){
                rcb.console._verboseAppend("done", status);
                if(callback) {
                    rcb._callCallback(callback);
                }
            }
            params={};
            params.data = readings;
            params.additionalValues = additionalValues;
            rcb._sendGUIData("newLogEntry",params);
        }
        readings.print = restorePrint;
    },
    /**
     * Creates a new empty file for writing raw text (in the user's working directory). Generates an error if user's working directory is not set.
     * @param {Object} [params] - parameters for file creation.
     * @param {string} [params.prefix="Auto"] - A prefix to append in front of the file.
     * @param {string} [params.extension="txt"] - Custom file extension.
     * @example
     * //Example recording to a raw text file
     * rcb.files.newTextFile({prefix: "RawTextExample"});
     * rcb.files.appendTextFile("Plain raw text\r\n", function(){
     *     rcb.files.appendTextFile("A new line...", function(){
     *         rcb.files.appendTextFile("same line...", function(){
     *             rcb.files.appendTextFile("more...", rcb.endScript);
     *         });
     *     });
     * });
     */
    newTextFile: function (params) {
        if(params===undefined) params={};
        if(params.prefix===undefined) params.prefix = "Auto";
        if(params.extension===undefined) params.extension = "txt";
        rcb._sendGUIData("newTextFile",params);
        rcb.files.newTextFile.called = true;
        rcb.files.newLogFile.called = false;
        rcb.console._verbosePrint('Creating new text file with "' + params.prefix + '" prefix in working directory');
    },
    /**
     * Callback for the appendTextFile function when finished writing to file.
     * @callback textSaved
     */

    /**
     * Appends new text to the created text file. Generates an error if the function newTextFile was never called.
     * @param {String} text - The raw text to append to the file.
     * @param {textSaved} [callback] - The function to execute when recording is done.
     */
    appendTextFile: function (text,callback) {
        if(!rcb.files.newTextFile.called) rcb.console.error("newTextFile function must be called before calling the appendTextFile function");
        else{
            var status = rcb.console._verbosePrint("Writing text to file...");
            rcb.vars.callbacks.appendTextFile = function(){
                rcb.console._verboseAppend("done", status);
                if(callback){
                    rcb._callCallback(callback);
                }
            }
            params={};
            params.data = text;
            rcb._sendGUIData("appendTextFile",params);
        }
    },
};
/**
 * UDP interface functions
 * @class
 * @example
 * var receive_port = 55047; // the listening port on this PC
 * var send_ip = "192.168.1.114"; // where to send the packet
 * var send_port = 64126; // on which port to send the packet
 *
 * rcb.udp.init(receive_port, send_ip, send_port, UDPInitialized);
 *
 * rcb.udp.onReceive(function UDPReceived(arrayBuffer){
 *     var message = rcb.udp.ab2str(arrayBuffer);
 *     rcb.console.print("Received: " + message);
 * });
 *
 * function UDPInitialized(){
 *     var buffer = rcb.udp.str2ab("Hi from RCbenchmark script!");
 *     rcb.udp.send(buffer);
 * }
 */
rcb.udp = {
    /**
     * Callback for the rcb.udp.init function when socket is ready.
     * @callback udpReady
     */

    /**
     * Create an UDP socket for external communication. Only one socket can be opened at a time.
     * @param {Integer} receivePort - The port to which the UDP packets will be received on this machine.
     * @param {String} SendIP - The IP address of the receiver for the packets
     * @param {Integer} SendPort - The port to send the packets to.
     * @param {udpReady} [callback] - The function to execute when the UDP socket is ready.
     */
    init: function (receivePort, SendIP, SendPort, callback) {
        rcb._sendGUIData("udpInit",{
            LISTEN_PORT: receivePort,
            OUT_IP: SendIP,
            OUT_PORT: SendPort
        });

        var status = rcb.console._verbosePrint("Initializing UDP ports...");
        rcb.vars.callbacks.udpInitialized = function(){
            rcb.console._verboseAppend("done", status);
            if(callback){
                rcb._callCallback(callback);
            }
        };
    },

    /**
     * Callback for the rcb.udp.send function when packet has sent.
     * @callback UDPsent
     */

    /**
     * Sends a packet to the IP/Port specified in the rcb.udp.init function.
     * @param {ArrayBuffer} sendData - The data to send. Use the str2ab helper function.
     * @param {UDPsent} [callback] - The function to execute when the UDP message is sent.
     */
    send: function (arrayBuffer, callback) {
        rcb._sendGUIData("udpSend",{arrayBuffer: arrayBuffer});
        var status = rcb.console._verbosePrint("Sending UDP packet...");
        rcb.vars.callbacks.udpSent = function(){
            rcb.console._verboseAppend("done", status);
            if(callback){
                rcb._callCallback(callback);
            }
        };
    },

    /**
     * Callback for the rcb.udp.onReceive function.
     * @callback UDPdataReceived
     * @param {ArrayBuffer} data - Received data. Use the ab2str helper function to convert it to a string.
     */

    /**
     * Calls the specified callback function when new data is received.
     * @param {UDPdataReceived} callback - The function to execute when the UDP message is sent.
     */
    onReceive: function (callback) {
        rcb.vars.callbacks.udpReceived = function(arrayBuffer){
            rcb.console._verbosePrint("UDP packet received.");
            if(callback){
                rcb._callCallback(callback,arrayBuffer);
            }
        };
    },

    /**
     * Helper function that converts a string into an ArrayBuffer Object.
     * @param {String} str - The string to convert.
     * @return {ArrayBuffer} The ArrayBuffer Object, which can be sent to the UDP functions
     */
    str2ab: function str2ab(str) {
        var buf = new ArrayBuffer(str.length);
        var bufView = new Uint8Array(buf);
        for (var i=0, strLen=str.length; i < strLen; i++) {
            bufView[i] = str.charCodeAt(i);
        }
        return buf;
    },

    /**
     * Helper function that converts an ArrayBuffer Object to a string.
     * @param {ArrauBuffer} arrayBuffer - The buffer to convert.
     * @return {String} The string representation of the ArrayBuffer Object.
     */
    ab2str: function ab2str(buf) {
        return String.fromCharCode.apply(null, new Uint8Array(buf));
    }
};
/**
 * Database interface functions
 * @class
 * @private
 */
rcb.database = {
    addData: function (data){
        var restorePrint = data.print;
        delete data.print;

        rcb._sendGUIData("databaseAdd", data);
        rcb.console._verbosePrint("Data added to queue.");

        data.print = restorePrint;
    },

    log: function (data){
        rcb._sendGUIData("databaseLog", data);
    },

    submit: function (callback, isCoaxial){
        rcb._sendGUIData("databasePost", isCoaxial);

        var status = rcb.console._verbosePrint("Sending data to database...");
        rcb.vars.callbacks.databasePosted = function(res){
            rcb.console._verboseAppend('done', status);
            if(res){
                rcb.console.warning('Browser should open automatically. If not go there:<br/><a href="' + res + '" target="_blank">' + res + '<a/> to continue.');
            }
            if(callback){
                rcb._callCallback(callback);
            }
        };
    }
};