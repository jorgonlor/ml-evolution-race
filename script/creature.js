"use strict";

var TIME_TO_LIVE = 90;
var MAX_TIME_WITHOUT_IMPROVING = 12;

var BIAS_MUTATION_PROBABILITY = 0.05;
var BIAS_MUTATION_CHANGE = 0.08;

var DEBUG_MODE = false;
var DEBUG_TIME = 0.5;
var MANUAL_CONTROL = false;

var CreatureType = {"first":1, "clone":2, "cross":3, "mutation":4, "new":5};

class Creature
{
    constructor(space, position, category, creatureType)
    {
		let initializer = 'glorotNormal';

		// this.brain = tf.tidy(() => {
		// 	return tf.sequential({
		// 		layers: [
		// 		tf.layers.dense({units: 8, inputShape: [5], kernelInitializer: initializer, biasInitializer: initializer}),
		// 		tf.layers.leakyReLU({units: 8, kernelInitializer: initializer, biasInitializer: initializer}),
		// 		tf.layers.dense({units: 2, /*activation: 'tanh',*/ kernelInitializer: initializer, biasInitializer: initializer})]
		// 	});
		// });

		this.brain = tf.tidy(() => {
			return tf.sequential({
				layers: [
				tf.layers.dense({units: 5, activation: 'linear', inputShape: [5], kernelInitializer: initializer, biasInitializer: initializer}),
				tf.layers.leakyReLU({units: 4, kernelInitializer: initializer, biasInitializer: initializer}),	
				tf.layers.leakyReLU({units: 3, kernelInitializer: initializer, biasInitializer: initializer}),		
				tf.layers.dense({units: 2, /*activation: 'linear',*/ kernelInitializer: initializer, biasInitializer: initializer})]
			});
		});

        this.radius = 6;
		this.sight_distance = 200;
		this.initPosition = new cp.v(position.x,position.y);
		var mass = 1.5;
		this.category = category;
        this.body = space.addBody(new cp.Body(mass, cp.momentForCircle(mass, 0, this.radius, cp.v(0, 0))));        
        this.shape = space.addShape(new cp.CircleShape(this.body, this.radius, cp.v(0, 0)));
        this.shape.setElasticity(0.8);
        this.shape.setFriction(1);
        this.shape.setCollisionType(category);
        //this.shape.setLayers(CREATURE_CATEGORY);
        this.shape.group = category;
        this.space = space;
		this.body.p = new cp.v(position.x, position.y);
		this.body.setAngle(0);
        this.shape.body.rot = cp.v(1,0);
		this.shape.creature = this;
		this.creatureType = creatureType;

		this.hitPoints = [];
		this.eyePoints = [];
        this.alive = true;
        this.creationTime = Date.now();
        this.timeWhenMax = Date.now();
		this.max_y = 0.0;
		
		this.debugTime = Date.now();

		this.angle = cp.v.toangle(this.body.rot);
		this.initAngle = this.angle;
		this.spinCount = 0;

		this.nextCheckpoint = 1;
		this.checkpointCount = 0;

		this.lapInitTime = Date.now();

		this.showEyeTracing = true;
    }

    calculateEyesRotations()
    {
        var rot = this.shape.body.rot;

        var rot_left_60 = cp.v(rot.x * 0.5 - rot.y * 0.8666, rot.x * 0.8666 + rot.y * 0.5);
        var rot_left_30 = cp.v(rot.x * 0.8666 - rot.y * 0.5, rot.x * 0.5 + rot.y * 0.8666);

        var rot_right_30 = cp.v(rot.x * 0.8666 + rot.y * 0.5, -rot.x * 0.5 + rot.y * 0.8666);
        var rot_right_60 = cp.v(rot.x * 0.5 + rot.y * 0.8666, -rot.x * 0.8666 + rot.y * 0.5);

        return [rot_left_60, rot_left_30, rot, rot_right_30, rot_right_60];
    }

    update()
    {
		if(!this.alive) 
			return;

        var p = this.shape.body.p;
        var now = Date.now();

        // if(p.y > this.max_y * 1.02) {
        //     this.max_y = p.y;
        //     this.timeWhenMax = now;
        // }

        if(!MANUAL_CONTROL && now - this.creationTime > TIME_TO_LIVE * 1000) {
            this.alive = false;
            console.log("Death by old age");
        }

        // if(now - this.timeWhenMax > MAX_TIME_WITHOUT_IMPROVING * 1000) {
        //     this.alive = false;
        //     console.log("Death by not improving");
		// }

		var new_angle = cp.v.toangle(this.body.rot);
		if(new_angle > this.initAngle && new_angle < this.initAngle + 0.2 && this.angle < this.initAngle && this.angle > this.initAngle - 0.2)
			this.spinCount += 1;
		if(new_angle < this.initAngle && new_angle > this.initAngle - 0.2 && this.angle > this.initAngle && this.angle < this.initAngle + 0.2)
			this.spinCount -= 1;

		if(this.nextCheckpoint == 0)
			this.spinCount = 0;
		if(this.spinCount > 2 || this.spinCount < -2) {
			this.alive = false;
			console.log("Death by spinning too much");
		}
		this.angle = new_angle;
        
        var rots = this.calculateEyesRotations();
        
		this.hitPoints = [];
		this.eyePoints = [];
        var eye_signals = [];
        for(var i = 0; i < rots.length; ++i) {            
            var p_near = vadd(p, vmult(rots[i], this.radius));
			var p_far = vadd(p, vmult(rots[i], this.sight_distance));
			
			this.eyePoints.push([p_near, p_far]);

            var eye_signal = 0.0;
            var query = this.space.segmentQueryFirst(p_near, p_far, this.shape.group, this.shape.group);
            if(query != null) {
                var hitPoint = query.hitPoint(p_near, p_far);
                this.hitPoints.push(hitPoint);
                eye_signal = (this.sight_distance - vdist(p, hitPoint)) / this.sight_distance;
            }
            eye_signals.push(eye_signal);
		}

		if(MANUAL_CONTROL == true) return;
		
		let vel = vlength(this.body.getVel()) / 100;
		
        var model_output = tf.tidy(()=> {
			return tf.tanh(this.brain.predict(tf.tensor2d([eye_signals])));
			//return this.brain.predict(tf.tensor2d([eye_signals.concat([vel])]));
		});
		
        var thrust_control = model_output.get(0,0);
        var turn_control = model_output.get(0,1);

        this.body.applyImpulse( vmult(this.shape.body.rot, 10 * thrust_control), cp.v(0, 0));

        this.body.applyImpulse( vmult(cp.v(-3, 0), turn_control), cp.v(0, 1));
		this.body.applyImpulse( vmult(cp.v(3, 0), turn_control), cp.v(0, -1));
		
		if(DEBUG_MODE && now - this.debugTime > DEBUG_TIME * 1000) {
			this.debugTime = now;
			console.log("Thrust: " + thrust_control + ", Turn: " + turn_control);			
		}
    }
    
    clone() {
		var new_creature = new Creature(this.space, this.initPosition, this.category);
		new_creature.creatureType = CreatureType.clone;

		for(var i = 0; i < this.brain.layers.length; ++i) {

			if(this.brain.layers[i].getWeights().length == 0) continue;

			var weights = this.brain.layers[i].getWeights()[0].dataSync();
			var new_weights = new_creature.brain.layers[i].getWeights()[0].dataSync();
			for(var j = 0; j < weights.length; ++j) {
				new_weights[j] = weights[j];
			}

			var bias = this.brain.layers[i].getWeights()[1].dataSync();
			var new_bias = new_creature.brain.layers[i].getWeights()[1].dataSync();
			for(var j = 0; j < bias.length; ++j) {
				new_bias[j] = bias[j];
			}
		}

		return new_creature;
    }
	
	crossover(other) {
		for(var i = 0; i < this.brain.layers.length; ++i) {

			if(this.brain.layers[i].getWeights().length == 0) continue;

			// Weights
			var weights = this.brain.layers[i].getWeights()[0].dataSync();
			var other_weights = other.brain.layers[i].getWeights()[0].dataSync();
			var mid = weights.length / 2;
			for(var j = mid; j < weights.length; ++j) {
				weights[j] = other_weights[j];
			}

			// Bias
			var bias = this.brain.layers[i].getWeights()[1].dataSync();
			var other_bias = other.brain.layers[i].getWeights()[1].dataSync();
			mid = bias.length / 2;
			for(var j = mid; j < bias.length; ++j) {
				bias[j] = other_bias[j];
			}
		}
    }

    mutate(mutationProbability, mutationChange) {
		for(let i = 0; i < this.brain.layers.length; ++i) {

			if(this.brain.layers[i].getWeights().length == 0) continue;

			var weights = this.brain.layers[i].getWeights()[0].dataSync();
			for(let j = 0; j < weights.length; ++j) {
				if(Math.random() < mutationProbability) {
				//if(Math.random() > 0.7) {
					weights[j] += Math.random() * mutationChange - (mutationChange / 2.0);
					// if(weights[j] > 1.3) weights[j] = 1.3;
					// if(weights[j] < -1.3) weights[j] = -1.3;
				}
			}

			var bias = this.brain.layers[i].getWeights()[1].dataSync();
			for(let j = 0; j < bias.length; ++j) {
				if(Math.random() < BIAS_MUTATION_PROBABILITY) {
				//if(Math.random() >0.95) {
					bias[j] += Math.random() * BIAS_MUTATION_CHANGE - (BIAS_MUTATION_CHANGE / 2.0);
					// if(bias[j] > 1.3) bias[j] = 1.3;
					// if(bias[j] < -1.3) bias[j] = -1.3;
				}
			}
		}
		return this;
    }

    fitness(checkpoints) {
		//return this.max_y;

		// Fitness is crossed checkpoints plus how close to next one normalized to (0-1)
		let cpCount = this.checkpointCount;

		let p = this.body.p;
		let nextCp = checkpoints[this.nextCheckpoint];
		let maxDistance = nextCp.maxDistanceToPrev;
		let nextCpMidPoint = nextCp.points[Math.floor(nextCp.points.length / 2)];
		let distanceToNextMid = vdist(p, nextCpMidPoint);

		let distanceBonus = (maxDistance - distanceToNextMid) / maxDistance;
		if(distanceBonus < 0)
			distanceBonus = 0;

		return cpCount + distanceBonus;
	}
	
	testFastPointInShape(p) {
		if(Math.abs(p.x - this.body.p.x) < this.radius && Math.abs(p.y - this.body.p.y) < this.radius)
			return true;
		return false;
	}
}