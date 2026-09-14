class_name SurvivorPlayer
extends CharacterBody2D

var move_speed: float = 250.0
var max_health: float = 100.0
var health: float = 100.0
var armor: float = 0.0
var pickup_radius: float = 120.0

var weapon_damage: float = 10.0
var attack_interval: float = 0.62
var projectile_speed: float = 620.0
var projectile_count: int = 1
var projectile_pierce: int = 1

var hurt_cooldown: float = 0.0
var facing := Vector2.RIGHT


func tick(delta: float, arena_size: Vector2) -> void:
	hurt_cooldown = maxf(0.0, hurt_cooldown - delta)

	var direction := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	var wasd := Vector2(
		float(Input.is_key_pressed(KEY_D)) - float(Input.is_key_pressed(KEY_A)),
		float(Input.is_key_pressed(KEY_S)) - float(Input.is_key_pressed(KEY_W))
	)
	if wasd.length_squared() > 0.0:
		direction = wasd.normalized()
	if direction.length_squared() > 0.0:
		facing = direction.normalized()

	velocity = direction * move_speed
	move_and_slide()
	position.x = clampf(position.x, 28.0, arena_size.x - 28.0)
	position.y = clampf(position.y, 28.0, arena_size.y - 28.0)
	queue_redraw()


func take_damage(raw_damage: float) -> bool:
	if hurt_cooldown > 0.0:
		return false
	health -= maxf(1.0, raw_damage - armor)
	hurt_cooldown = 0.18
	queue_redraw()
	return health <= 0.0


func heal(amount: float) -> void:
	health = minf(max_health, health + amount)
	queue_redraw()


func _draw() -> void:
	# Shadow and body
	draw_ellipse(Vector2(2.0, 12.0), Vector2(21.0, 10.0), Color(0.0, 0.0, 0.0, 0.28))
	var body_color := Color("59d5ff") if hurt_cooldown <= 0.0 else Color("ffffff")
	draw_circle(Vector2.ZERO, 18.0, Color("16324c"))
	draw_circle(Vector2.ZERO, 15.0, body_color)

	# Direction marker and small energy core
	var nose := facing * 19.0
	draw_circle(nose, 5.0, Color("ffdc6a"))
	draw_circle(Vector2.ZERO, 6.0, Color("e9fbff"))
	draw_arc(Vector2.ZERO, 23.0, -PI * 0.78, PI * 0.78, 24, Color(0.35, 0.84, 1.0, 0.35), 2.0)


func draw_ellipse(center: Vector2, radius: Vector2, color: Color) -> void:
	var points := PackedVector2Array()
	for i in range(20):
		var angle := TAU * float(i) / 20.0
		points.append(center + Vector2(cos(angle) * radius.x, sin(angle) * radius.y))
	draw_colored_polygon(points, color)

