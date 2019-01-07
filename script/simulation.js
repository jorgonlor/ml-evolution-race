"use strict";

var WALL_CATEGORY = 1;
var CREATURE_CATEGORY = 2;
var TIME_TO_LIVE = 90;

var circuitPoints = [
 [[530, 228], [534, 108]], 
 [[715, 229], [704, 109]], 
 [[823, 194], [776, 87]], 
 [[909, 147], [898, 54]], 
 [[1003, 146], [1053, 62]], 
 [[1100, 207], [1250, 183]], 
 [[1153, 334], [1290, 331]], 
 [[1144, 453], [1280, 462]], 
 [[1118, 501], [1188, 589]], 
 [[1049, 514], [1066, 614]],
 [[999, 493], [953, 585]],
 [[978, 445], [879, 519]],
 [[975, 423], [877, 413]],
 [[1008, 311], [890, 355]],
 [[970, 245], [878, 342]],

 [[880, 211], [859, 338]],
 [[788, 231], [846, 346]],
 [[725, 324], [804, 377]],
 [[699, 408], [790, 458]],

 [[679, 433], [745, 525]],

 [[661, 448],  [682, 564]], 
 [[633, 444], [607, 554]],

 [[606, 421],  [551, 523]], 
 [[537, 387],  [485, 485]], 
 [[409, 399],  [430, 480]], 
 [[340, 452],  [373, 516]], 
 [[262, 476],  [282, 558]],
 [[204, 472], [187, 544]],
  
 [[146, 451],  [97, 505]],
 [[127, 401], [53, 434]], 
 [[115, 335],  [20, 344]], 
 [[140, 248],  [48, 206]], 
 [[233, 197],  [159, 85]], 
 [[310, 183],  [300, 72]], 
 [[413, 227],  [424, 116]]
]; 

class Simulation {

    constructor(renderer) {
        this.space = new cp.Space();

        this.renderer = renderer;

        //Configure space
        var space = this.space;
        space.iterations = 30;
        space.gravity = cp.v(0, 0);
        space.damping = 0.1;
        space.sleepTimeThreshold = 0.5;
        space.collisionSlop = 0.5;
        space.addCollisionHandler(CREATURE_CATEGORY, WALL_CATEGORY, this.handleCreatureWallCollision, null, null, null);

        this.createCircuit(circuitPoints, true);
        this.creaturesInitPosition = this.calculateCircuitInitPosition(circuitPoints);

        this.generationCount = 0;
        this.generationBest = 0;
        this.generationBestPrevious = 0;  
        this.generationStartTime = Date.now();

        this.bestLapTime = Number.MAX_SAFE_INTEGER;

        this.eyeTracingCheckBox = document.getElementById('eyeTracing');
        this.mutationProbabilityEdit = document.getElementById('mutProb');
        this.mutationChangeEdit = document.getElementById('mutChange');
        this.numCreaturesEdit = document.getElementById('numCreatures');
        this.deadOnCollisionCheckBox = document.getElementById('deadOnCollision');
        this.propulsionMultiplierEdit = document.getElementById('propMult');
        this.useTanhEdit = document.getElementById('useTanh');

        // Creatures
        this.creatures = [];
        for(var i = 0; i < this.numCreaturesEdit.value; ++i) {
            this.creatures.push(new Creature(this.space, this.creaturesInitPosition, CREATURE_CATEGORY, CreatureType.new));
        }
        
        // var self = this;
        // document.addEventListener('keydown', function(event) {
        //     var creature = self.creatures[0];
        //     var rot = creature.shape.body.rot;
        //     if(event.keyCode == 87)  // w
        //     {
        //         creature.shape.body.applyImpulse( vmult(rot, 10), cp.v(0, 0));
        //     }
        //     if(event.keyCode == 83)  // s
        //     {
        //         creature.shape.body.applyImpulse( vmult(rot, -10), cp.v(0, 0));
        //     }
        //     if(event.keyCode == 65)  // a
        //     {
        //         creature.shape.body.applyImpulse( cp.v(-10, 0), cp.v(0, 1));
        //         creature.shape.body.applyImpulse( cp.v(10, 0), cp.v(0, -1));
        //     }
        //     if(event.keyCode == 68)  // d
        //     {
        //         creature.shape.body.applyImpulse( cp.v(10, 0), cp.v(0, 1));
        //         creature.shape.body.applyImpulse( cp.v(-10, 0), cp.v(0, -1));
        //     }
        //     if(event.keyCode == 80)  // p
        //     {
        //         console.log(self.creatures[0].fitness(self.checkpoints));
        //     }
        // });
    }

    createCircuit(circuitPoints, loop) {
        var self = this;
        let addWall = function(p0, p1) {
            let wall = self.space.addShape(new cp.SegmentShape(self.space.staticBody, cp.v(p0[0], p0[1]), cp.v(p1[0], p1[1]), 0));
            wall.setElasticity(1);
            wall.setFriction(1);
            wall.setCollisionType(WALL_CATEGORY);
            wall.group = WALL_CATEGORY;
            self.static_walls.push(wall); 
        }

        this.static_walls = [];
        for(let k = 0; k < 2; ++k) {
            for (let i = 0; i < circuitPoints.length - 1; ++i) {
                let p0 = circuitPoints[i][k]
                let p1 = circuitPoints[i + 1][k]

                addWall(p0, p1);        
            }
        }

        if(loop == true) {
            let pFirstInner = circuitPoints[0][0];
            let pFirstOuter = circuitPoints[0][1];
            let pLastInner = circuitPoints[circuitPoints.length - 1][0];
            let pLastOuter = circuitPoints[circuitPoints.length - 1][1];

            addWall(pLastInner, pFirstInner); 
            addWall(pLastOuter, pFirstOuter);   
        }

        this.generateCheckpoints(circuitPoints);
    }

    calculateCircuitInitPosition(circuitPoints) {
        let p0inner = circuitPoints[0][0];
        let p0outer = circuitPoints[0][1];
        let p1inner = circuitPoints[1][0];
        let p1outer = circuitPoints[1][1];

        let midXinner = (p0inner[0] + p1inner[0]) / 2;
        let midXouter = (p0outer[0] + p1outer[0]) / 2;
        let midX = (midXinner + midXouter) / 2;

        let midY0 = (p0inner[1] + p0outer[1]) / 2;
        let midY1 = (p1inner[1] + p1outer[1]) / 2;
        let midY = (midY0 + midY1) / 2;

        return cp.v(midX, midY);
    }

    generateCheckpoints(circuitPoints) {
        this.checkpoints = {};

        for(let i = 0; i < circuitPoints.length; ++i) {
            this.checkpoints[i] = {};
            let pInner = new cp.v(circuitPoints[i][0][0], circuitPoints[i][0][1]);
            let pOuter = new cp.v(circuitPoints[i][1][0], circuitPoints[i][1][1]);

            var checks = [];
            var step = 15;
            var stepX = (pOuter.x - pInner.x) / step;
            var stepY = (pOuter.y - pInner.y) / step;
            for(let j = 0; j <= step; ++j) {
                let p = new cp.v(pInner.x + j * stepX, pInner.y + j * stepY);
                checks.push(p);                
            }
            this.checkpoints[i].points = checks;
        }

        let checkpointsLength = Object.keys(this.checkpoints).length;
        for(let i = 0; i < checkpointsLength; ++i) {
            let prev = (i-1);
            if(prev < 0) prev += checkpointsLength;

            let thisPoints = this.checkpoints[i].points;
            let prevPoints = this.checkpoints[prev].points;

            let thisMidPoint = thisPoints[Math.floor(thisPoints.length / 2)];
            let maxDistance = 0;
            for(let j = 0; j < prevPoints.length; ++j) {
                let distance = vdist(thisMidPoint, prevPoints[j]);
                if(distance > maxDistance)
                    maxDistance = distance;
            }
            this.checkpoints[i].maxDistanceToPrev = maxDistance;
        }
    }

    handleCreatureWallCollision(arb, space) {
        if(self.sim.deadOnCollisionCheckBox.checked) {
            var c = arb.a.collision_type == CREATURE_CATEGORY ? arb.a : arb.b;
            c.creature.alive = false;
        }
        //console.log("Death by collision");
        return true;
    }

    run() {
        this.running = true;
        var self = this;
        var lastTime = 0;
        var step = function (time) {

            self.update(time - lastTime);
            self.draw();

            lastTime = time;

            if (self.running) {
                window.requestAnimationFrame(step);
            }
        };
        step(0);
    }

    advanceCheckpoints(creature) {       
        let advanced = true;

        while(advanced) {
            let nextCheckpoint = this.checkpoints[creature.nextCheckpoint].points;
            for(let i = 0; i < nextCheckpoint.length; ++i) {
                if(creature.testFastPointInShape(nextCheckpoint[i]))
                {                    
                    ++creature.nextCheckpoint;
                    creature.nextCheckpoint = creature.nextCheckpoint % Object.keys(this.checkpoints).length;   
                    ++creature.checkpointCount;   
                    advanced = true;

                    // if completed a lap
                    if(creature.nextCheckpoint == 1) {
                        let lapTime = Date.now() - creature.lapInitTime;
                        if(lapTime < this.bestLapTime) {
                            this.bestLapTime = lapTime;
                        }
                        creature.lapInitTime = Date.now();
                    } 
                    break;              
                }
                else
                {
                    advanced = false;
                }
            }
        }
    }

    update(dt) {
        let now = Date.now();
        this.space.step(1/60);

        let mutationProbability = this.mutationProbabilityEdit.value;
        let mutationChange = this.mutationChangeEdit.value;
        let numCreatures = this.numCreaturesEdit.value;
    
        for(let i = 0; i < this.creatures.length; ++i) {
            this.creatures[i].update();
            this.advanceCheckpoints(this.creatures[i]);
            this.creatures[i].showEyeTracing = this.eyeTracingCheckBox.checked;
        }

        // if(now - this.generationStartTime > TIME_TO_LIVE) {
        //     this.creatures.forEach(c => c.alive = false);
        //     
        // }
    
        if(this.creatures.every(c => !c.alive)) {
    
            for(let i = 0; i < this.creatures.length; ++i) {
                this.space.removeShape(this.creatures[i].shape);
                this.space.removeBody(this.creatures[i].body);
            }
            
            this.creatures.sort((c1, c2) => c2.fitness(this.checkpoints) - c1.fitness(this.checkpoints));
            let numSurvivors = Math.floor(numCreatures / 5);
            var survivors = this.creatures.slice(0, numSurvivors);
            var first = survivors[0];
            this.creatures = [];
            
            this.generationBestPrevious = this.generationBest;
            this.generationBest = first.fitness(this.checkpoints);
            console.log("Generation best: " + this.generationBest);
    
            // crosses
            for(let i = 0; i < survivors.length - 1; ++i) {
                for(let j = i + 1; j < survivors.length; ++j) {
                    let cc = survivors[i].clone();
                    cc.crossover(survivors[j]);
                    cc.creatureType = CreatureType.cross;
                    this.creatures.push(cc.mutate(0.02, 0.02));
                }
            }
    
            // clone first
            let fclone = first.clone()
            fclone.creatureType = CreatureType.first;
            this.creatures.push(fclone)

            // fine mutations
            let numFimeMutations = numCreatures >= 10 ? 2 : 1;
            for(let i = 0; i < numFimeMutations; ++i) {
                let mutationOfFirst = first.clone().mutate(0.85, 0.05);
                mutationOfFirst.creatureType = CreatureType.new;
                this.creatures.push(mutationOfFirst);
            }
    
            // coarse mutations
            let creatures_len = this.creatures.length;
            for(let i = 0; i < numCreatures - creatures_len; ++i) {
                let mutationOfFirst = first.clone().mutate(mutationProbability, mutationChange);
                mutationOfFirst.creatureType = CreatureType.mutation;
                this.creatures.push(mutationOfFirst);
            }

            if(this.generationCount < 6)
            {
                this.creatures.push(new Creature(this.space, this.creaturesInitPosition, CREATURE_CATEGORY, CreatureType.new));
                this.creatures.push(new Creature(this.space, this.creaturesInitPosition, CREATURE_CATEGORY, CreatureType.new));
            }
    
            ++this.generationCount;
            this.generationStartTime = now;
        }
    }

    draw() {
        this.renderer.clear();

        for(let i = 0; i < this.creatures.length; ++i)        
            this.renderer.draw(this.creatures[i]);        

        for(let i = 0; i < this.static_walls.length; ++i)        
            this.renderer.draw(this.static_walls[i]);  
           
        // draw checkpoints
        for(let i = 0; i < circuitPoints.length; ++i) {
            let p0 = circuitPoints[i][0];
            let p1 = circuitPoints[i][1];
            this.renderer.drawLine(cp.v(p0[0], p0[1]), cp.v(p1[0], p1[1]), 'grey', 1);
        } 
        
        // for(let i in this.checkpoints)
        // {
        //     for(let j = 0; j < this.checkpoints[i].points.length; ++j) {
        //         this.renderer.drawCircle(this.checkpoints[i].points[j], 3);
        //     }
        // }

        let text = "Generation: " + this.generationCount;
        text += "   Best: " + this.generationBest.toFixed(2);
        text += "   Previous: " + this.generationBestPrevious.toFixed(2);
        text += "   Remaining gen time: " + Math.floor((TIME_TO_LIVE * 1000 - (Date.now() - this.generationStartTime)) / 1000);
        text += "   Best lap: " + ((this.bestLapTime != Number.MAX_SAFE_INTEGER) ? ((this.bestLapTime/1000).toFixed(2) + "s") : "N/A");        
        
        this.renderer.printInfo(text);
    }
};

        //this.canvas.onmousedown = function (e) {
        //    console.log(canvas2point(e.clientX, e.clientY))
            // e.preventDefault();
            // var rightclick = e.which === 3; // or e.button === 2;
            // self.mouse = canvas2point(e.clientX, e.clientY);

            // if (!rightclick && !self.mouseJoint) {
            //     var point = canvas2point(e.clientX, e.clientY);

            //     var shape = space.pointQueryFirst(point, GRABABLE_MASK_BIT, cp.NO_GROUP);
            //     if (shape) {
            //         var body = shape.body;
            //         var mouseJoint = self.mouseJoint = new cp.PivotJoint(mouseBody, body, v(0, 0), body.world2Local(point));

            //         mouseJoint.maxForce = 50000;
            //         mouseJoint.errorBias = Math.pow(1 - 0.15, 60);
            //         space.addConstraint(mouseJoint);
            //     }
            // }

            // if (rightclick) {
            //     self.rightClick = true;
            // }
        //};

        //this.canvas.onmouseup = function (e) {
            // var rightclick = e.which === 3; // or e.button === 2;
            // self.mouse = canvas2point(e.clientX, e.clientY);

            // if (!rightclick) {
            //     if (self.mouseJoint) {
            //         space.removeConstraint(self.mouseJoint);
            //         self.mouseJoint = null;
            //     }
            // }

            // if (rightclick) {
            //     self.rightClick = false;
            // }
        //};
                // var mouseBody = this.mouseBody = new cp.Body(Infinity, Infinity);
        // this.canvas.oncontextmenu = function (e) {
        //     return false;
        // }*/



