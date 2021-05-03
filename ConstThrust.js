/* //////////////// Description ////////////////

This Script sets the RPM of the Motor content usung a PID Controller


Usage:

q - Increase ki
a - Decrease ki
w - Increase kd
s - Decrease kd
e - Increase kp
d - decrease kp
r - Increase RPM
f - Decrease RPM
t - Increase Max Sum for Ki
g - Decrease Max Sum for Ki
0-9 - Set mark in Results File

///////////// User defined script parameters //////////// */

var minPWM = 1050;
var maxPWM = 1950;
// ESC initialization
var minVal = 1000;  // ESC initialization value (us)
var initDur = 2; // ESC initialization time (s)
// StartupTime
var startTime = 4;   //Startup Time
var startPWM = 1150; // Startup Value

// Test repeat
var maxTime = 100; // Not used

var targetThrust = 1;
var kpEntered = 0.1;   //Independent of timestep
var kdEntered = 0.01;  //Independent of Timestep
var kiEntered = 0.001; //Independent of timestep
var maxI = 1000;

// TimeStep
var time = 0.025; // Frequency

// Caluclate and initlialise vlaues
var curPWM = startPWM;
var kp = kpEntered*time; // Fix Kp so that it is constant over time
var kd = kdEntered; // No changem because DRPM different
var ki = kiEntered*time; // Fix Kp so that it is constant over time

// Init variables for Output
var thrust = 0; // thrust Value
var dif = 0;    // Difference between real and thrust
var rpmChange = 0; // Change in RPM since last measurement
var mark = 0;     // Mark in Output

var filePrefix = "ConstVel";

var receive_port = 55047; // the listening port on this PC
var send_ip = "172.17.11.79"; // where to send the packet
var send_port = 64126; // on which port to send the packet

// start new log file
var add = ["targetThrust", "Change","Integral","P","I","D","kp","ki","kd","Mark"];
rcb.files.newLogFile({prefix: filePrefix, additionalHeaders: add});

// hide console debug info
rcb.console.setVerbose(false);

///////////////// Beginning of the script //////////////////

//Sequence Values
var index = 0;
var totalTime = 0;
var oldThrust = 0;
var sum = 0;
var init = 1;
readSensor(); // Get values during Startup
initlization();

function initlization(){
// ESC initialization
    rcb.udp.init(receive_port, send_ip, send_port, UDPInitialized);
    rcb.console.print("Initializing ESC...");
    rcb.output.set("escA",minVal);
    rcb.wait(startup, initDur);
}

function startup(){
// Motor Startup
    rcb.console.print("Start Motor");
    rcb.output.set("escA",startPWM);
    rcb.wait(sequence, startTime);
}


function sequence(){

    init=0; // Disable logging in startup mode
    index = index+time;

    //Clear console to avoid instabilities
    if (index >=1){
        rcb.console.clear();
    }

    readSensors(); //Read Sensor values

    rcb.wait(sequence, time); //Wait until next excetution
}

function readSensors(){

    totalTime = totalTime + time;

    // take a sample
    rcb.sensors.read(setRPM, 1);
}

function setRPM(result){

    thrust = result.thrust.workingValue;

    dif = targetThrust-thrust;
    rpmChange = thrust - oldThrust;
    sum = sum+dif;

    sum = Math.max(Math.min(sum,maxI),-maxI); // Limit sum
    var changeD = Math.max(Math.min(kd*(-rpmChange),20),-20); // Limit input
    var changeI = Math.max(Math.min(sum*ki,20),-20);        // Limit input


    //if (rpmChange/time<-100){ // Limit PWM Change during deceleration
    //dif=0;
    //}

    curPWM = Math.max(Math.min(curPWM + dif*kp + changeD+changeI,maxPWM ),minPWM); // Calculate new PWM value

    if (index>=1){ // Output once a second
        rcb.console.print('PWM: '+ curPWM.toFixed(0)+ "\tdiff: " + dif.toFixed(0) + "\tCorr: "+ (dif*kp).toFixed(2) + '\tRPMChange: '+ rpmChange.toFixed(0) + "\tCorr: " + (kd*(-rpmChange)).toFixed(2) + "\toldThrust: " +oldThrust.toFixed(0)+ "\tSum: "+ sum.toFixed(0)+"Corr: " + (sum*ki).toFixed(2));
        index = 0;
    }

    rcb.output.set("escA",curPWM); // Set PWM signal

    oldThrust=thrust; //Save last value

    // Save Log file
    var add = [targetThrust, rpmChange,sum,dif*kp,sum*ki,kd*(-rpmChange),kp/time,ki/time,kd,mark];
    rcb.files.newLogEntry(result, readSensor,add);
}


// Output Values to logfile during startup
function readSensor(){
    if (init==1){ //Abort if after startup
        rcb.sensors.read(saveResult,1);
    }
}

function saveResult(result){
    var add = [targetThrust, rpmChange,sum,dif*kp,sum*ki,kd*(-rpmChange),kp/time,ki/time,kd,mark];
    rcb.files.newLogEntry(result, readSensor,add);
}


// Setup keypress callback function
rcb.onKeyboardPress(function(key){
    // Print on screen which key was pressed
    var ascii = String.fromCharCode(key);
    if (key == 69){
        kp = kp*1.1;
        rcb.console.print("New Kp: " +kp/time);
    }else if (key == 68){
        kp = kp/1.1;
        rcb.console.print("New Kp: " +kp/time);
    }else if (key == 87){
        kd = kd*1.1;
        rcb.console.print("New Kd: " +kd);
    } else if (key == 83){
        kd = kd/1.1;
        rcb.console.print("New Kd: " +kd);
    } else if (key == 82){
        targetThrust = targetThrust+1;
        rcb.console.print("New targetThrust: " +targetThrust);
    } else if (key == 70){
        targetThrust = targetThrust-1;
        rcb.console.print("New targetThrust: " +targetThrust);
    } else if (key == 81){
        ki = ki*1.1;
        rcb.console.print("New ki: " +ki/time);
    } else if (key == 65){
        ki = ki/1.1;
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
        var buffer = rcb.udp.str2ab("end");
        rcb.udp.send(buffer);
        rcb.console.print("Send End");
    } else if (key >= 48 && key<=57){
        mark = key-48;
        rcb.console.print("Mark: " +mark);
    } else {

        rcb.console.print("You pressed " + ascii + " (ASCII " + key + ")");
    }
});


