/* //////////////// Description ////////////////

This Script sets the RPM of the Motor content usung a PD Controller
*/
var minPWM = 1050; 
var maxPWM = 1650;
// StartupTime
var startTime = 4;   //Startup Time
var startPWM = 1150; // Startup Value
var curPWM = startPWM;


// TimeStep
var time = 0.025; // Frequency

// Caluclate and initlialise vlaues
var targetRPM = 2500;
var kp = 0.1*time; // Fix Kp so that it is constant over time
var kd = 0.01; // No change because RPM different

// Init variables for Output
var optical = 0; // Optical RPM Value
var dif = 0;    // Difference between real and optical RPM
var rpmChange = 0; // Change in RPM since last measurement
let changeD = 0; // Differntial Change
var oldRPM = 0;
var oldThrust = 0;

// Variables for constant thrust
var targetThrust = 1;
var thrust = 0; // thrust Value
var kpT = 10*time; // Fix Kp so that it is constant over time
var kdT = 1; // No changem because DRPM different

//UDP Variables
var receive_port = 3041; // the listening port on this PC
var send_ip = "127.0.0.1"; // where to send the packet
var send_port = 3042; // on which port to send the packet
var iteration = 0; // Number of skipped Messages_Running
var frequency = 3; // Number of skipped Messages

// Polar
var minVal = 1100;         // Min. input value [700us, 2300us]
var maxVal = 1920;         // Max. input value [700us, 2300us]
var t = 60;                // Time of the ramp input (seconds)
var plateauDuration = 5;   // Time to wait at each plateau (seconds)
var samplesAvg = 20;       // Number of samples to average at each reading (reduces noise and number of CSV rows)

// Set Mode
var target = 1; // 1 for Const RPM, 2 for const Thrust

// Log file
var filePrefix = "Startup";
var fileName = "";
var add = ["TargetRPM", "Change","Integral","P","I","D","kp","ki","kd","Mark"];
var mark = 0;     // Mark in Output

//Sequence Values
var init = 0;
var stopValue = 0;

//Start Log file
rcb.files.newLogFile({prefix: filePrefix, additionalHeaders: add});
// hide console debug info
rcb.console.setVerbose(false);

///////////////// Beginning of the script //////////////////

// ESC initialization
rcb.console.print("Initializing ESC...");
rcb.output.set("escA",minVal);

readSensorInit(); // Get values during Startup
rcb.udp.init(receive_port, send_ip, send_port, UDPInitialized);
//startup();

function UDPInitialized(){
    rcb.udp.onReceive(UDPReceived); // Register callback event
}

// Output Values to logfile during startup
function readSensorInit(){
    if (init === 0){ //End if Script starts
        rcb.sensors.read(sendUDP,1);
        rcb.wait(readSensorInit, 0.1); //Wait until next execution
    }
}

//Stop current excecution
function stop(){
    stopValue = 1;
    rcb.console.print("Stop excecution");
    rcb.output.set("escA",minPWM);
    init=0; // Disable logging in startup mode
    readSensorInit(); // restart logging without run data
}

// Tare Load cells and Current
function tare(){
    rcb.sensors.tareCurrent();
    rcb.sensors.tareLoadCells();
}


// Motor Startup
function startup(){
    rcb.console.print("Start Motor");
    rcb.output.set("escA",startPWM);
    init=1; // Disable logging in startup mode
    rcb.wait(sequence, startTime);
}


function sequence(){
    if (!stopValue) {
        readSensors(); //Read Sensor values
        rcb.wait(sequence, time); //Wait until next execution
    }
}

function readSensors(){
    // take a sample
    rcb.sensors.read(setRPM, 1);
}

function setRPM(result){

    if (target == 1) {// Constant RPM
        optical = result.motorOpticalSpeed.workingValue - oldRPM > 1000 ? result.motorOpticalSpeed.workingValue : oldRPM;
        dif = Math.min(targetRPM - optical,100); // Limit maximum change
        rpmChange = Math.min(optical - oldRPM, 50); // Limit maximum diff
        changeD = Math.max(Math.min(kd * (-rpmChange), 20), -20); // Limit input
        curPWM = Math.max(Math.min(curPWM + dif * kp + changeD, maxPWM), minPWM); // Calculate new PWM value
        oldRPM=optical; //Save last value
    } else if (target == 2){ // Constant Thrust
        thrust = result.thrust.workingValue*9.81;
        dif = targetThrust-thrust;
        rpmChange = thrust - oldThrust;
        changeD = Math.max(Math.min(kdT*(-rpmChange),20),-20); // Limit input
        curPWM = Math.max(Math.min(curPWM + dif*kpT + changeD,maxPWM ),minPWM); // Calculate new PWM value
        oldThrust = thrust;
    }

    rcb.output.set("escA",curPWM); // Set PWM signal

    // Save Log file
    var add = [targetRPM, rpmChange,0,dif*kp,0,kd*(-rpmChange),kp/time,0/time,kd,mark];
    rcb.files.newLogEntry(result,null,add);
    sendUDP(result);
}


function sendUDP(result){
    iteration += 1;
    if (iteration >= frequency) {
        try {
            let temp = result.temp4N76.workingValue.toFixed(2);
            let time = result.time.workingValue.toFixed(3);
            let escA = result.escA.workingValue.toFixed(0);
            let torque = result.torque.workingValue.toFixed(3);
            let thrust = result.thrust.workingValue*9.81;
            thrust = thrust.toFixed(3);
            let voltage = result.voltage.workingValue.toFixed(2);
            let current = result.current.workingValue.toFixed(2);
            let motorOpticalSpeed = result.motorOpticalSpeed.workingValue.toFixed(0);
            var buffer2 = rcb.udp.str2ab(motorOpticalSpeed + ',' + temp + ',' + time + ',' + escA + ',' + torque + ',' + thrust + ',' + voltage + ',' + current + '\n');
            rcb.udp.send(buffer2);
            iteration = 0;
            //rcb.console.print('PWM: '+ curPWM.toFixed(0)+ "\tdiff: " + dif.toFixed(0) + "\tCorr: "+ (dif*kp).toFixed(2) + '\tRPMChange: '+ rpmChange.toFixed(0) + "\tCorr: " + (kd*(-rpmChange)).toFixed(2) + "\toldRpm: " +oldRPM.toFixed(0)+ "\tSum: "+ sum.toFixed(0));
        } catch (error) {
            // expected output: ReferenceError: nonExistentFunction is not defined
            // Note - error messages will vary depending on browser
        }
    }
}


///////////////// Polar //////////////////
function startupPolar() {
//Reading sensors and writing to file continuously
    rcb.files.newLogFile({prefix: filePrefix});
    readSensorPolar();   // Start the loop. After readSensor(), readDone() followed by readSensor(), etc.

//ESC initialization
    rcb.console.print("Initializing ESC...");
    rcb.output.set("esc",1000);
    rcb.wait(startPlateau, 4);
}

function readSensorPolar(){
    //rcb.console.setVerbose(false);
    rcb.sensors.read(readDone, samplesAvg);
    //rcb.console.setVerbose(true);
}

function readDone(result){
    rcb.console.setVerbose(false);
    rcb.files.newLogEntry(result,null,readSensorPolar);
    rcb.console.setVerbose(true);
    sendUDP(result);
}

//Start plateau
function startPlateau(){
    rcb.console.print("Start Plateau...");
    rcb.output.set("esc",minVal);
    rcb.wait(rampUp, plateauDuration);
}

//Ramp up
function rampUp(){
    rcb.console.print("Ramping Up...");
    rcb.output.ramp("esc", minVal, maxVal, t, upPlateau);
}

//Up Plateau
function upPlateau() {
    rcb.console.print("Up Plateau...");
    rcb.wait(endPolar, plateauDuration);
}


//Ends or loops the script
function endPolar() {
    rcb.output.set("esc",minVal);
}

function UDPReceived(arrayBuffer) {
    var message = rcb.udp.ab2str(arrayBuffer);
    rcb.console.print("Received: " + message);
    if (message.startsWith("Start,")) {
        stopValue = 0;
        fileName = message.split(",")[3];
        targetRPM = Number(message.split(",")[2]);
        targetThrust = Number(message.split(",")[7]);
        filePrefix = "Run_" + message.split(",")[1]+ "" + message.split(",")[3] + "_" + message.split(",")[4];
        rcb.files.newLogFile({prefix: filePrefix, additionalHeaders: add});
        if (message.includes("Constant_RPM")){
            rcb.console.print("Constant RPM ");
            target = 1;
            startup();   // Start the sensor read loop until script is stopped.
        } else if (message.includes("Constant_Thrust")){
            target = 2;
            startup();   // Start the sensor read loop until script is stopped.
        } else if (message.includes("Polar")){
            startupPolar();
        }
    } else if (message.startsWith("RPM")) {
        rcb.console.print(message);
        targetRPM = Number(message.split(",")[1]);
        rcb.console.print(targetRPM);
    } else if (message.startsWith("Thrust")) {
        rcb.console.print(message);
        targetThrust = Number(message.split(",")[1]);
        rcb.console.print(targetThrust);
    } else if (message.startsWith("Mark")) {
        mark = Number(message.split(",")[1]);
    } else if (message.startsWith("kpT")) {
        kpT = Number(message.split(",")[1])*time;
    }else if (message.startsWith("kp")) {
        kp = Number(message.split(",")[1])*time;
    }else if (message.startsWith("Stop")){
        stop(); // End script
    }else if (message.startsWith("Tare")){
        tare(); // End script
    }
}
/*
// Setup keypress callback function
rcb.onKeyboardPress(function(key){
    // Print on screen which key was pressed
    if (key == 69){
        kp = kp*1.1;
        kpT = kpT*1.1;
        rcb.console.print("New Kp: " +kp/time);
    }else if (key == 68){
        kp = kp/1.1;
        kpT = kpT*1.1;
        rcb.console.print("New Kp: " +kp/time);
    }else if (key == 87){
        kd = kd*1.1;
        kdT = kdT*1.1;
        rcb.console.print("New Kd: " +kd);
    } else if (key == 83){
        kd = kd/1.1;
        kdT = kdT/1.1;
        rcb.console.print("New Kd: " +kd);
    } else if (key == 82){
        targetRPM = targetRPM+50;
        targetThrust = targetThrust+0.5;
        rcb.console.print("New targetRPM: " +targetRPM);
    } else if (key == 70){
        targetRPM = targetRPM-50;
        targetThrust = targetThrust-0.5;
        rcb.console.print("New targetRPM: " +targetRPM);
    } else if (key == 81){
        ki = ki*1.1;
        kiT = kiT*1.1;
        rcb.console.print("New ki: " +ki/time);
    } else if (key == 65){
        ki = ki/1.1;
        kiT = kiT/1.1;
        rcb.console.print("New ki: " +ki);
    } else if (key == 84){
        maxI = maxI*1.1;
        rcb.console.print("New maxI: " +maxI);
    } else if (key == 71){
        maxI = maxI/1.1;
        rcb.console.print("New ki: " +maxI);
    } else if (key == 72){
        var buffer = rcb.udp.str2ab("start");
        rcb.udp.send(buffer);
        rcb.console.print("Send Start");
    } else if (key == 73){
        var buffer2 = rcb.udp.str2ab("end");
        rcb.udp.send(buffer2);
        rcb.console.print("Send End");
    } else if (key >= 48 && key<=57){
        mark = key-48;
        rcb.console.print("Mark: " +mark);
    } //else {
        //var ascii = String.fromCharCode(key);
        //rcb.console.print("You pressed " + ascii + " (ASCII " + key + ")");
    //}
});
*/