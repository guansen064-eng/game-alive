class_name ChaserEnemy
extends Node2D

var max_health: float = 20.0
var health: float = 20.0
var speed: float = 80.0
var contact_damage: float = 8.0
var attack_cooldown: float = 0.0
var is_elite: bool = false
var dead: bool = false
var radius: float = 18.0
var phase: float = 0.0


func configure(survival_seconds: float, elite: bool) -> void:
	is_elite = elite
	var threat := survival_seconds / 45.0
	max_health = 18.0 + threat * 10.0
	speed = 72.0 + minf(65.0, threat * 5.5) + randf_range(-8.0, 10.0)
	contact_damage = 7.0 + threat * 1.6
	if is_elite:
		max_health *= 3.4
		speed *= 0.88
		contact_damage *= 1.65
		radius = 28.0
	health = max_health
	phase = randf() * TAU
	queue_redraw()


func tick(target_position: Vector2, delta: float) -> void:
	attack_cooldown = maxf(0.0, attack_cooldown - delta)
	phase += delta * 4.0
	position += position.direction_to(target_position) * speed * delta
	rotation = sin(phase) * 0.06


func can_attack() -> bool:
	if attack_cooldown > 0.0:
		return false
	attack_cooldown = 0.72
	return true


func take_damage(amount: float) -> bool:
	if dead:
		return false
	health -= amount
	queue_redraw()
	return health <= 0.0


func _draw() -> void:
	var main_color := Color("ff5370") if not is_elite else Color("c06cff")
	var dark_color := Color("72263b") if not is_elite else Color("54256e")

	draw_circle(Vector2(2.0, radius * 0.5), radius * 0.95, Color(0.0, 0.0, 0.0, 0.24))
	draw_circle(Vector2.ZERO, radius, dark_color)
	draw_circle(Vector2(0.0, -2.0), radius - 4.0, main_color)
	draw_circle(Vector2(-radius * 0.32, -radius * 0.16), radius * 0.15, Color.WHITE)
	draw_circle(Vector2(radius * 0.32, -radius * 0.16), radius * 0.15, Color.WHITE)
	draw_circle(Vector2(-radius * 0.28, -radius * 0.14), radius * 0.07, Color("24152c"))
	draw_circle(Vector2(radius * 0.28, -radius * 0.14), radius * 0.07, Color("24152c"))

	if health < max_health:
		var bar_width := radius * 2.0
		draw_rect(Rect2(-bar_width * 0.5, -radius - 10.0, bar_width, 4.0), Color("311d31"))
		draw_rect(Rect2(-bar_width * 0.5, -radius - 10.0, bar_width * maxf(0.0, health / max_health), 4.0), Color("7dff9b"))

