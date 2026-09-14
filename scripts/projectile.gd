class_name EnergyProjectile
extends Node2D

var direction := Vector2.RIGHT
var speed: float = 600.0
var damage: float = 10.0
var remaining_hits: int = 1
var lifetime: float = 1.8
var hit_ids: Dictionary = {}


func configure(new_direction: Vector2, new_speed: float, new_damage: float, pierce: int) -> void:
	direction = new_direction.normalized()
	speed = new_speed
	damage = new_damage
	remaining_hits = maxi(1, pierce)
	rotation = direction.angle()


func tick(delta: float) -> bool:
	position += direction * speed * delta
	lifetime -= delta
	return lifetime <= 0.0


func can_hit(enemy: Node) -> bool:
	return not hit_ids.has(enemy.get_instance_id())


func register_hit(enemy: Node) -> bool:
	hit_ids[enemy.get_instance_id()] = true
	remaining_hits -= 1
	return remaining_hits <= 0


func _draw() -> void:
	draw_line(Vector2(-20.0, 0.0), Vector2(-5.0, 0.0), Color(0.35, 0.9, 1.0, 0.18), 8.0)
	draw_circle(Vector2.ZERO, 7.0, Color(0.15, 0.65, 1.0, 0.22))
	draw_circle(Vector2.ZERO, 4.0, Color("86f5ff"))
	draw_circle(Vector2(1.0, -1.0), 1.5, Color.WHITE)

