class Renderer {
    constructor(canvas_id, width, height) {
        this.canvas = document.getElementById(canvas_id);
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d');  
        this.scale = 1.0;
        var self = this;

        this.point2canvas = function (point) {
            return cp.v(point.x * self.scale, (height - point.y) * self.scale);
        };

        var canvas2point = this.canvas2point = function (x, y) {
            var rect = self.canvas.getBoundingClientRect(); //so canvas can be anywhere on the page
            return cp.v((x / self.scale) - rect.left, height - y / self.scale + rect.top);
        };

        this.point2canvas = function (point) {
            return cp.v(point.x * self.scale, (self.canvas.height - point.y) * self.scale);
        };

        this.canvas.onmousemove = function (e) {
            self.mouse = canvas2point(e.clientX, e.clientY);
        };

        this.canvas.onmousedown = function (e) {
            let p = canvas2point(e.clientX, e.clientY);
            console.log("[" + p.x + ", " + p.y + "], ");
        };

        this.canvas.onmouseup = function (e) {
        };
        
        this.defineDrawingFunctions();
    }

    clear() {
        this.ctx.strokeStyle = 'black';
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawLine(a, b, color, width) { 
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = width;       
        a = this.point2canvas(a);
        b = this.point2canvas(b);
        this.ctx.beginPath();
        this.ctx.moveTo(a.x, a.y);
        this.ctx.lineTo(b.x, b.y);
        this.ctx.stroke();
    }

    drawCircle(tc, r) {
        var c = this.point2canvas(tc);
        this.ctx.beginPath();
        this.ctx.arc(c.x, c.y, this.scale * r, 0, 2 * Math.PI, false);
        this.ctx.fill();
        this.ctx.stroke();  
    }

    printInfo(text) {
        this.ctx.font = "30px Comic Sans MS";
        this.ctx.fillStyle = "red";
        this.ctx.textAlign = "left";
        let textPos = this.point2canvas(cp.v(20,20));
        this.ctx.fillText(text, textPos.x, textPos.y); 
    }

    draw(element) {
        element.draw(this.ctx, this.scale, this.point2canvas);
    }

    defineDrawingFunctions() {
        var self = this;

        cp.SegmentShape.prototype.draw = function (ctx, scale, point2canvas) {
            var oldLineWidth = ctx.lineWidth;
            ctx.lineWidth = Math.max(1, this.r * scale * 2);
            self.drawLine(this.ta, this.tb, 'black', 2);
            ctx.lineWidth = oldLineWidth;
        };

        Creature.prototype.draw = function (ctx, scale, point2canvas) {
            let style;
            switch(this.creatureType)
            {
                case CreatureType.first: style = "white"; break;
                case CreatureType.clone: style = "green"; break;
                case CreatureType.cross: style = "grey"; break;
                case CreatureType.mutation: style = "yellow"; break;
                case CreatureType.new: style = "black"; break;
            }

            ctx.fillStyle = style;
            this.shape.draw(ctx, scale, point2canvas);

            // eye traces and wall hits
            if(this.alive && this.showEyeTracing)
            {
                for(var i = 0; i < this.eyePoints.length; ++i) {
                    self.drawLine(this.eyePoints[i][0], this.eyePoints[i][1], 'black', 1); 
                }

                for(var h = 0; h < this.hitPoints.length; ++h) {
                    ctx.fillStyle = "red";
                    self.drawCircle(this.hitPoints[h], 3);
                }
            }

            // orientation line
            let p_near = this.body.p;
            let p_far = vadd(this.body.p, vmult(this.body.rot, this.radius));
            self.drawLine(p_near, p_far, 'black', 1);
        }

        cp.CircleShape.prototype.draw = function (ctx, scale, point2canvas) {
            self.drawCircle(this.tc, this.r);
        }   
    }
};