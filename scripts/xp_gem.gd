class_name ExperienceGem
extends Node2D

var value: int = 1
var spin: float = 0.0


func configure(new_value: int) -> void:
	value = new_value
	if value >= 5:
		scale = Vector2.ONE * 1.35


func tick(target_position: Vector2, pickup_radius: float, delta: float) -> bool:
	spin += delta * 2.8
	rotation = spin
	var distance := position.distance_to(target_position)
	if distance < pickup_radius:
		var pull_strength := lerpf(280.0, 820.0, 1.0 - distance / pickup_radius)
		position += position.direction_to(target_position) * pull_strength * delta
	return position.distance_to(target_position) < 23.0


func _draw() -> void:
	var color := Color("62f5b0") if value < 5 else Color("ffd66b")
	var points := PackedVector2Array([
		Vector2(0.0, -9.0), Vector2(7.0, 0.0),
		Vector2(0.0, 9.0), Vector2(-7.0, 0.0)
	])
	draw_colored_polygon(points, color)
	draw_polyline(PackedVector2Array([points[0], points[1], points[2], points[3], points[0]]), Color.WHITE, 1.5)

