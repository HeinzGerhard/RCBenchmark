/* //////////////// Description ////////////////

This simple script allows performing endurance tests for extended periods of time. The user defines a test sequence consisting of arbitrary steps with arbitrary durations. The sequence can be repeated as many times as required. A data sample is recorded at the middle of every step in the test sequence.

Assuming the user specified test is as follows:
test = [[1200, 4], [1400, 2], [1200, 4], [1600, 1]];

The test will be as follows: 

  . represents where a sample will be recorded
  * represents the end of the script, or where the sequence will repeat

     ^ Motor Input
1600 |                         __._
1400 |              __._      |    |               
1200 |        __.__|    |__.__|    |  
1000 |    ___|                     *
     |_______0_____4____6_____10___11_________> Time

In this example, the throttle starts at 1000 to initialize the ESC, and the sequence then begins. The sequence starts at time t=0 and finishes at time t=11. If the sequence repeats, it will repeat at 11s = 0s.

///////////// User defined script parameters //////////// */

// Test sequence: here we have four points defined, but you can 
// put as many as you want. First value is ESC pwm, and second 
// value is duration in seconds.
var test = [[1000, 10], [2000, 10], [3000, 10], [4000, 10]];

// Test repeat
var repeat = 1; // set to 1 to run the sequence only once

// ESC initialization
var minVal = 1000;  // ESC initialization value (us)
var initDur = 4; // ESC initialization time (s)

var filePrefix = "Polar";


var targetRPM = 2500;
var kpEntered = 0.1;   //Independent of timestep
var kdEntered = 0.01;  //Independent of Timestep
var kiEntered = 0.001; //Independent of timestep
var maxI = 1000;
var oldRPM = 0;
var sum = 0;
var startPWM = 1200;
var maxPWM = 1900;
var minPWM = 1000;
var init = 0;
// TimeStep
var time = 0.025; // Frequency

// Caluclate and initlialise vlaues
var curPWM = startPWM;
var kp = kpEntered*time; // Fix Kp so that it is constant over time
var kd = kdEntered; // No changem because DRPM different
var ki = kiEntered*time; // Fix Kp so that it is constant over time

// Init variables for Output
var optical = 0; // Optical RPM Value
var dif = 0;    // Difference between real and optical RPM
var rpmChange = 0; // Change in RPM since last measurement
var mark = 0;     // Mark in Output
var step = 0;     // Mark in Output


// UDP Values
var receive_port = 55047; // the listening port on this PC
var send_ip = "172.17.11.79"; // where to send the packet
var send_port = 64126; // on which port to send the packet

// runs the sequence
var index = 0;
var index1 = 0;
var total = repeat;
var totalTime = 0;
var stepTime = 0;

// start new log file
var add = ["TargetRPM", "Change","Integral","P","I","D","kp","ki","kd","Mark","Step"];
rcb.files.newLogFile({prefix: filePrefix, additionalHeaders: add});

///////////////// Beginning of the script //////////////////

// ESC initialization
rcb.console.print("Initializing ESC...");
rcb.output.set("esc",minVal);
rcb.wait(sequence, initDur);

// hide console debug info
rcb.console.setVerbose(false);

function sequence(){
    
    index1 = index1+time;
    if(index > -1){
        if(index === test.length){
            // end of sequence
            index = -1;
            sequence();
        }else{
            // get step info
            targetRPM = test[index][0];
            var times = test[index][1];

            readSensors(); //Read Sensor values

            //rcb.console.print("StepTime: " +stepTime);
            //rcb.console.print("times: " +times);
            //rcb.console.print("Index: " +index);
            if(stepTime > times){
                index = index +1;
                stepTime = 0;
                rcb.console.print("TargetRPM: " +targetRPM);
            }

            rcb.wait(sequence, time); //Wait until next execution
        }
    }else {
        rcb.endScript();
    }
}

function readSensors(){

    totalTime = totalTime + time;
    stepTime = stepTime + time;

    // take a sample
    rcb.sensors.read(setRPM, 1);
}

function setRPM(result){

    optical = result.motorOpticalSpeed.workingValue;

    dif = targetRPM-optical;
    rpmChange = optical - oldRPM;
    sum = sum+dif;

    sum = Math.max(Math.min(sum,maxI),-maxI); // Limit sum
    var changeD = Math.max(Math.min(kd*(-rpmChange),20),-20); // Limit input
    var changeI = Math.max(Math.min(sum*ki,20),-20);        // Limit input


    //if (rpmChange/time<-100){ // Limit PWM Change during deceleration
    //dif=0;
    //}

    curPWM = Math.max(Math.min(curPWM + dif*kp + changeD+changeI,maxPWM ),minPWM); // Calculate new PWM value

    if (index1>=1){ // Output once a second
        rcb.console.print('PWM: '+ curPWM.toFixed(0)+ "\tdiff: " + dif.toFixed(0) + "\tCorr: "+ (dif*kp).toFixed(2) + '\tRPMChange: '+ rpmChange.toFixed(0) + "\tCorr: " + (kd*(-rpmChange)).toFixed(2) + "\toldRpm: " +oldRPM.toFixed(0)+ "\tSum: "+ sum.toFixed(0)+"Corr: " + (sum*ki).toFixed(2));
        index1 = 0;
    }

    rcb.output.set("escA",curPWM); // Set PWM signal

    oldRPM=optical; //Save last value

    // Save Log file
    var add = [targetRPM, rpmChange,sum,dif*kp,sum*ki,kd*(-rpmChange),kp/time,ki/time,kd,mark,stepTime];
    rcb.files.newLogEntry(result, readSensor,add);
}


// Output Values to logfile during startup
function readSensor(){
    if (init==1){ //Abort if after startup
        rcb.sensors.read(saveResult,1);
    }
}

function saveResult(result){
    var add = [targetRPM, rpmChange,sum,dif*kp,sum*ki,kd*(-rpmChange),kp/time,ki/time,kd,mark];
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
        targetRPM = targetRPM+50;
        rcb.console.print("New targetRPM: " +targetRPM);
    } else if (key == 70){
        targetRPM = targetRPM-50;
        rcb.console.print("New targetRPM: " +targetRPM);
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
        var buffer2 = rcb.udp.str2ab("end");
        rcb.udp.send(buffer2);
        rcb.console.print("Send End");
    } else if (key >= 48 && key<=57){
        mark = key-48;
        rcb.console.print("Mark: " +mark);
    } else {

        rcb.console.print("You pressed " + ascii + " (ASCII " + key + ")");
    }
});