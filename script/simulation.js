"use strict";

var WALL_CATEGORY = 1;
var CREATURE_CATEGORY = 2;
//var NUM_CREATURES = 18;
var NUM_CREATURES = 10;

var MUTATION_PROBABILITY = 0.2;
var MUTATION_CHANGE = 1.7;
// var MUTATION_PROBABILITY = 0.7;
// var MUTATION_CHANGE = 0.4;

var circuitPoints = [
 [[530, 228], [534, 108]], 
 [[715, 229], [704, 109]], 
 [[823, 194], [776, 87]], 
 [[909, 147], [898, 54]], 
 [[1003, 146], [1053, 62]], 
 [[1100, 207], [1250, 183]], 
 [[1112, 298], [1290, 331]], 
 [[1080, 367], [1200, 462]], 
 [[990, 405],  [1034, 536]], 
 [[873, 426],  [888, 565]], 
 [[775, 440],  [781, 558]], 
 [[661, 448],  [630, 560]], 
 [[606, 421],  [551, 523]], 
 [[537, 387],  [485, 485]], 
 [[405, 367],  [430, 480]], 
 [[327, 417],  [373, 516]], 
 [[256, 445],  [282, 558]], 
 [[213, 430],  [133, 505]], 
 [[201, 335],  [62, 344]], 
 [[205, 248],  [64, 197]], 
 [[247, 197],  [159, 85]], 
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

        // Creatures
        this.creatures = [];
        for(var i = 0; i < NUM_CREATURES; ++i) {
            this.creatures.push(new Creature(this.space, this.creaturesInitPosition, CREATURE_CATEGORY, CreatureType.new));
        }

        this.generationCount = 0;
        this.generationBest = 0;
        this.generationBestPrevious = 0;  

        this.bestLapTime = Number.MAX_SAFE_INTEGER;
        
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
        var c = arb.a.collision_type == CREATURE_CATEGORY ? arb.a : arb.b;
        c.creature.alive = false;
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
                    console.log("Checkpoint reached " + creature.nextCheckpoint);
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
        this.space.step(1/60);
    
        for(let i = 0; i < this.creatures.length; ++i) {
            this.creatures[i].update();

            this.advanceCheckpoints(this.creatures[i]);
        }
    
        if(this.creatures.every(c => !c.alive)) {
    
            for(let i = 0; i < this.creatures.length; ++i) {
                this.space.removeShape(this.creatures[i].shape);
                this.space.removeBody(this.creatures[i].body);
            }
            
            this.creatures.sort((c1, c2) => c2.fitness(this.checkpoints) - c1.fitness(this.checkpoints));
            var survivors = this.creatures.slice(0, Math.min(4, this.creatures.length));
            var first = survivors[0];
            this.creatures = [];
            
            this.generationBestPrevious = this.generationBest;
            this.generationBest = first.fitness(this.checkpoints);
            console.log("Generation best: " + this.generationBest);
    
            for(let i = 0; i < survivors.length - 1; ++i) {
                for(let j = i + 1; j < survivors.length; ++j) {
                    let cc = survivors[i].clone();
                    cc.crossover(survivors[j]);
                    cc.creatureType = CreatureType.cross;
                    this.creatures.push(cc.mutate(0.02, 0.02));
                }
            }
    
            let fclone = first.clone()
            fclone.creatureType = CreatureType.first;
            this.creatures.push(fclone)
    
            // if(this.generationCount < 6)
            // {
            //     this.creatures.push(new Creature(this.space, this.creaturesInitPosition, CREATURE_CATEGORY, CreatureType.new));
            //     this.creatures.push(new Creature(this.space, this.creaturesInitPosition, CREATURE_CATEGORY, CreatureType.new));
            // }
    
            let creatures_len = this.creatures.length;
            for(let i = 0; i < NUM_CREATURES - creatures_len; ++i) {
                let mutationOfFirst = first.clone().mutate(0.08, 1.7);
                mutationOfFirst.creatureType = CreatureType.mutation;
                this.creatures.push(mutationOfFirst);
            }
    
            for(let i = 0; i < 2; ++i) {
                let mutationOfFirst = first.clone().mutate(0.85, 0.05);
                mutationOfFirst.creatureType = CreatureType.new;
                this.creatures.push(mutationOfFirst);
            }
    
            ++this.generationCount;
        }
    }

    draw() {
        this.renderer.clear();

        for(let i = 0; i < this.creatures.length; ++i)        
            this.renderer.draw(this.creatures[i]);        

        for(let i = 0; i < this.static_walls.length; ++i)        
            this.renderer.draw(this.static_walls[i]);  
           
        // draw checkpoints
        //for(let i = 0; i < circuitPoints.length; ++i) {
            // let p0 = circuitPoints[i][0];
            // let p1 = circuitPoints[i][1];
            // this.renderer.drawLine(cp.v(p0[0], p0[1]), cp.v(p1[0], p1[1]));
        //} 
        
        for(let i in this.checkpoints)
        {
            for(let j = 0; j < this.checkpoints[i].points.length; ++j) {
                this.renderer.drawCircle(this.checkpoints[i].points[j], 3);
            }
        }

        //var aaa = document.getElementById('mutProb').value;

        let text = "Generation: " + this.generationCount + ", Best: " + this.generationBest.toFixed(2) + ", Previous: " + this.generationBestPrevious.toFixed(2);
        if(this.bestLapTime != Number.MAX_SAFE_INTEGER) {
            text += ", Best lap: " + (this.bestLapTime/1000).toFixed(2) + "s";
        }
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



