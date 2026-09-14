extends Node2D

const PlayerEntity = preload("res://scripts/player.gd")
const EnemyEntity = preload("res://scripts/enemy.gd")
const ProjectileEntity = preload("res://scripts/projectile.gd")
const GemEntity = preload("res://scripts/xp_gem.gd")

const ARENA_SIZE := Vector2(2400.0, 1600.0)
const UPGRADE_POOL := [
	{"id": "damage", "title": "过载弹头", "description": "武器伤害 +5"},
	{"id": "fire_rate", "title": "快速充能", "description": "攻击间隔缩短 15%"},
	{"id": "move_speed", "title": "轻量靴", "description": "移动速度 +25"},
	{"id": "max_health", "title": "生命扩容", "description": "最大生命 +20，并回复 20"},
	{"id": "projectile_count", "title": "分裂核心", "description": "每次额外发射 1 枚弹丸"},
	{"id": "projectile_speed", "title": "磁轨加速", "description": "弹丸速度 +100"},
	{"id": "pickup_radius", "title": "收集磁场", "description": "拾取范围 +50"},
	{"id": "armor", "title": "合金外壳", "description": "受到的伤害 -1"},
	{"id": "pierce", "title": "相位穿透", "description": "弹丸穿透 +1"},
	{"id": "heal", "title": "紧急修复", "description": "立即回复 40 点生命"}
]

var player: SurvivorPlayer
var enemies: Array = []
var projectiles: Array = []
var gems: Array = []

var game_state := "playing"
var survival_time: float = 0.0
var spawn_cooldown: float = 0.0
var attack_cooldown: float = 0.0
var kills: int = 0
var level: int = 1
var experience: int = 0
var experience_to_next: int = 8

var health_bar: ProgressBar
var health_label: Label
var experience_bar: ProgressBar
var level_label: Label
var timer_label: Label
var threat_label: Label
var kills_label: Label
var upgrade_overlay: ColorRect
var upgrade_list: VBoxContainer
var upgrade_title: Label
var game_over_overlay: ColorRect
var result_label: Label


func _ready() -> void:
	randomize()
	build_interface()
	new_game()
	queue_redraw()


func _physics_process(delta: float) -> void:
	if game_state != "playing":
		return

	survival_time += delta
	spawn_cooldown -= delta
	attack_cooldown -= delta
	player.tick(delta, ARENA_SIZE)

	if spawn_cooldown <= 0.0:
		var spawn_count := 1 + int(survival_time / 75.0)
		for i in range(spawn_count):
			spawn_enemy()
		spawn_cooldown = maxf(0.20, 0.86 - survival_time * 0.0035)

	update_enemies(delta)
	if game_state != "playing":
		update_hud()
		return
	update_projectiles(delta)
	update_gems(delta)
	if game_state != "playing":
		update_hud()
		return

	if attack_cooldown <= 0.0 and not enemies.is_empty():
		fire_weapon()
		attack_cooldown = player.attack_interval

	update_hud()


func _unhandled_input(event: InputEvent) -> void:
	if game_state == "game_over" and event.is_action_pressed("ui_accept"):
		new_game()


func new_game() -> void:
	clear_world()
	survival_time = 0.0
	spawn_cooldown = 0.25
	attack_cooldown = 0.2
	kills = 0
	level = 1
	experience = 0
	experience_to_next = 8
	game_state = "playing"
	upgrade_overlay.visible = false
	game_over_overlay.visible = false

	player = PlayerEntity.new()
	add_child(player)
	player.position = ARENA_SIZE * 0.5

	var camera := Camera2D.new()
	player.add_child(camera)
	camera.position_smoothing_enabled = true
	camera.position_smoothing_speed = 7.0
	camera.limit_left = 0
	camera.limit_top = 0
	camera.limit_right = int(ARENA_SIZE.x)
	camera.limit_bottom = int(ARENA_SIZE.y)
	camera.make_current()
	update_hud()


func clear_world() -> void:
	for collection in [enemies, projectiles, gems]:
		for node in collection:
			if is_instance_valid(node):
				node.queue_free()
		collection.clear()
	if is_instance_valid(player):
		player.queue_free()


func spawn_enemy() -> void:
	var enemy: ChaserEnemy = EnemyEntity.new()
	var elite_chance := 0.0 if survival_time < 45.0 else minf(0.18, 0.035 + survival_time / 1800.0)
	enemy.configure(survival_time, randf() < elite_chance)
	add_child(enemy)

	var angle := randf() * TAU
	var spawn_distance := randf_range(620.0, 820.0)
	var candidate := player.position + Vector2.from_angle(angle) * spawn_distance
	enemy.position = Vector2(
		clampf(candidate.x, 40.0, ARENA_SIZE.x - 40.0),
		clampf(candidate.y, 40.0, ARENA_SIZE.y - 40.0)
	)
	if enemy.position.distance_to(player.position) < 430.0:
		enemy.position = player.position + player.position.direction_to(enemy.position) * 430.0
		enemy.position.x = clampf(enemy.position.x, 40.0, ARENA_SIZE.x - 40.0)
		enemy.position.y = clampf(enemy.position.y, 40.0, ARENA_SIZE.y - 40.0)
	enemies.append(enemy)


func update_enemies(delta: float) -> void:
	for i in range(enemies.size() - 1, -1, -1):
		var enemy: ChaserEnemy = enemies[i]
		if not is_instance_valid(enemy) or enemy.dead:
			enemies.remove_at(i)
			continue
		enemy.tick(player.position, delta)
		if enemy.position.distance_to(player.position) < enemy.radius + 18.0 and enemy.can_attack():
			if player.take_damage(enemy.contact_damage):
				end_game()
				return


func fire_weapon() -> void:
	var target := find_nearest_enemy()
	if target == null:
		return
	var base_direction: Vector2 = player.position.direction_to(target.position)
	var spread := deg_to_rad(9.0)
	for i in range(player.projectile_count):
		var offset := (float(i) - float(player.projectile_count - 1) * 0.5) * spread
		var projectile: EnergyProjectile = ProjectileEntity.new()
		projectile.configure(base_direction.rotated(offset), player.projectile_speed, player.weapon_damage, player.projectile_pierce)
		add_child(projectile)
		projectile.position = player.position + base_direction * 22.0
		projectiles.append(projectile)


func find_nearest_enemy() -> ChaserEnemy:
	var nearest: ChaserEnemy = null
	var nearest_distance := INF
	for enemy in enemies:
		if not is_instance_valid(enemy) or enemy.dead:
			continue
		var distance := player.position.distance_squared_to(enemy.position)
		if distance < nearest_distance:
			nearest_distance = distance
			nearest = enemy
	return nearest


func update_projectiles(delta: float) -> void:
	for i in range(projectiles.size() - 1, -1, -1):
		var projectile: EnergyProjectile = projectiles[i]
		if not is_instance_valid(projectile):
			projectiles.remove_at(i)
			continue
		var expired := projectile.tick(delta)
		if not expired:
			for enemy in enemies:
				if not is_instance_valid(enemy) or enemy.dead or not projectile.can_hit(enemy):
					continue
				if projectile.position.distance_to(enemy.position) <= enemy.radius + 8.0:
					if enemy.take_damage(projectile.damage):
						kill_enemy(enemy)
					expired = projectile.register_hit(enemy)
					if expired:
						break
		if expired:
			projectile.queue_free()
			projectiles.remove_at(i)


func kill_enemy(enemy: ChaserEnemy) -> void:
	if enemy.dead:
		return
	enemy.dead = true
	kills += 1
	var gem: ExperienceGem = GemEntity.new()
	gem.configure(5 if enemy.is_elite else 1)
	add_child(gem)
	gem.position = enemy.position
	gems.append(gem)
	enemy.queue_free()


func update_gems(delta: float) -> void:
	for i in range(gems.size() - 1, -1, -1):
		var gem: ExperienceGem = gems[i]
		if not is_instance_valid(gem):
			gems.remove_at(i)
			continue
		if gem.tick(player.position, player.pickup_radius, delta):
			gain_experience(gem.value)
			gem.queue_free()
			gems.remove_at(i)
			if game_state != "playing":
				break


func gain_experience(amount: int) -> void:
	experience += amount
	if experience >= experience_to_next and game_state == "playing":
		trigger_level_up()


func trigger_level_up() -> void:
	experience -= experience_to_next
	level += 1
	experience_to_next = int(round(8.0 + pow(float(level), 1.35) * 4.2))
	game_state = "level_up"
	show_upgrade_choices()
	update_hud()


func show_upgrade_choices() -> void:
	for child in upgrade_list.get_children():
		child.queue_free()
	upgrade_title.text = "等级 %d · 选择一项强化" % level
	var options := UPGRADE_POOL.duplicate(true)
	options.shuffle()
	for option in options.slice(0, 3):
		var button := Button.new()
		button.text = "%s\n%s" % [option["title"], option["description"]]
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		button.custom_minimum_size = Vector2(520.0, 76.0)
		button.add_theme_font_size_override("font_size", 19)
		button.add_theme_color_override("font_color", Color("dff7ff"))
		button.add_theme_color_override("font_hover_color", Color.WHITE)
		button.add_theme_stylebox_override("normal", make_box(Color("17334d"), 12, 1, Color("315f7a")))
		button.add_theme_stylebox_override("hover", make_box(Color("245271"), 12, 2, Color("66d9ff")))
		button.add_theme_stylebox_override("pressed", make_box(Color("10283e"), 12, 2, Color("ffdc6a")))
		button.pressed.connect(choose_upgrade.bind(String(option["id"])))
		upgrade_list.add_child(button)
	upgrade_overlay.visible = true


func choose_upgrade(id: String) -> void:
	match id:
		"damage":
			player.weapon_damage += 5.0
		"fire_rate":
			player.attack_interval = maxf(0.16, player.attack_interval * 0.85)
		"move_speed":
			player.move_speed += 25.0
		"max_health":
			player.max_health += 20.0
			player.heal(20.0)
		"projectile_count":
			player.projectile_count = mini(7, player.projectile_count + 1)
		"projectile_speed":
			player.projectile_speed += 100.0
		"pickup_radius":
			player.pickup_radius += 50.0
		"armor":
			player.armor += 1.0
		"pierce":
			player.projectile_pierce += 1
		"heal":
			player.heal(40.0)

	upgrade_overlay.visible = false
	game_state = "playing"
	if experience >= experience_to_next:
		trigger_level_up()


func end_game() -> void:
	game_state = "game_over"
	game_over_overlay.visible = true
	var minutes := floori(survival_time / 60.0)
	var seconds := floori(survival_time) % 60
	result_label.text = "坚持时间  %02d:%02d\n消灭敌人  %d\n到达等级  %d" % [minutes, seconds, kills, level]


func update_hud() -> void:
	if not is_instance_valid(player):
		return
	health_bar.max_value = player.max_health
	health_bar.value = maxf(0.0, player.health)
	health_label.text = "生命  %d / %d" % [ceili(maxf(0.0, player.health)), int(player.max_health)]
	experience_bar.max_value = experience_to_next
	experience_bar.value = experience
	level_label.text = "LV.%d" % level
	var minutes := floori(survival_time / 60.0)
	var seconds := floori(survival_time) % 60
	timer_label.text = "%02d:%02d" % [minutes, seconds]
	threat_label.text = "威胁 %d" % (1 + floori(survival_time / 30.0))
	kills_label.text = "击破  %d" % kills


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, ARENA_SIZE), Color("091525"), true)
	for x in range(0, int(ARENA_SIZE.x) + 1, 80):
		draw_line(Vector2(x, 0.0), Vector2(x, ARENA_SIZE.y), Color(0.15, 0.35, 0.5, 0.12), 1.0)
	for y in range(0, int(ARENA_SIZE.y) + 1, 80):
		draw_line(Vector2(0.0, y), Vector2(ARENA_SIZE.x, y), Color(0.15, 0.35, 0.5, 0.12), 1.0)
	for x in range(40, int(ARENA_SIZE.x), 240):
		for y in range(40, int(ARENA_SIZE.y), 240):
			draw_circle(Vector2(x, y), 3.0, Color(0.25, 0.75, 0.95, 0.18))
	draw_rect(Rect2(Vector2.ZERO, ARENA_SIZE), Color("2e6d91"), false, 5.0)


func build_interface() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(root)

	# Health block
	health_label = Label.new()
	health_label.position = Vector2(28.0, 22.0)
	health_label.add_theme_font_size_override("font_size", 18)
	health_label.add_theme_color_override("font_color", Color("f2f8ff"))
	root.add_child(health_label)
	health_bar = ProgressBar.new()
	health_bar.position = Vector2(28.0, 50.0)
	health_bar.size = Vector2(280.0, 16.0)
	health_bar.show_percentage = false
	health_bar.add_theme_stylebox_override("background", make_box(Color("251f32"), 7))
	health_bar.add_theme_stylebox_override("fill", make_box(Color("ff5370"), 7))
	root.add_child(health_bar)

	# Timer and threat
	timer_label = Label.new()
	timer_label.set_anchors_preset(Control.PRESET_CENTER_TOP)
	timer_label.position = Vector2(-48.0, 18.0)
	timer_label.size = Vector2(96.0, 38.0)
	timer_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	timer_label.add_theme_font_size_override("font_size", 28)
	timer_label.add_theme_color_override("font_color", Color("ffdc6a"))
	root.add_child(timer_label)
	threat_label = Label.new()
	threat_label.set_anchors_preset(Control.PRESET_CENTER_TOP)
	threat_label.position = Vector2(-48.0, 54.0)
	threat_label.size = Vector2(96.0, 24.0)
	threat_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	threat_label.add_theme_font_size_override("font_size", 14)
	threat_label.add_theme_color_override("font_color", Color("8db2c8"))
	root.add_child(threat_label)

	kills_label = Label.new()
	kills_label.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	kills_label.position = Vector2(-190.0, 25.0)
	kills_label.size = Vector2(160.0, 30.0)
	kills_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	kills_label.add_theme_font_size_override("font_size", 18)
	kills_label.add_theme_color_override("font_color", Color("d9f5ff"))
	root.add_child(kills_label)

	# Experience bar across bottom
	level_label = Label.new()
	level_label.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	level_label.position = Vector2(24.0, -54.0)
	level_label.size = Vector2(90.0, 32.0)
	level_label.add_theme_font_size_override("font_size", 21)
	level_label.add_theme_color_override("font_color", Color("68f0b1"))
	root.add_child(level_label)
	experience_bar = ProgressBar.new()
	experience_bar.anchor_left = 0.0
	experience_bar.anchor_top = 1.0
	experience_bar.anchor_right = 1.0
	experience_bar.anchor_bottom = 1.0
	experience_bar.offset_left = 112.0
	experience_bar.offset_top = -48.0
	experience_bar.offset_right = -28.0
	experience_bar.offset_bottom = -33.0
	experience_bar.show_percentage = false
	experience_bar.add_theme_stylebox_override("background", make_box(Color("102b31"), 7))
	experience_bar.add_theme_stylebox_override("fill", make_box(Color("45e09a"), 7))
	root.add_child(experience_bar)
	var hint := Label.new()
	hint.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	hint.position = Vector2(25.0, -27.0)
	hint.text = "WASD / 方向键移动 · 武器自动锁定最近目标"
	hint.add_theme_font_size_override("font_size", 13)
	hint.add_theme_color_override("font_color", Color(0.65, 0.75, 0.82, 0.75))
	root.add_child(hint)

	build_upgrade_overlay(root)
	build_game_over_overlay(root)


func build_upgrade_overlay(root: Control) -> void:
	upgrade_overlay = ColorRect.new()
	upgrade_overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	upgrade_overlay.color = Color(0.01, 0.025, 0.05, 0.82)
	upgrade_overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	root.add_child(upgrade_overlay)

	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.position = Vector2(-310.0, -235.0)
	panel.size = Vector2(620.0, 470.0)
	panel.add_theme_stylebox_override("panel", make_box(Color("0c1c2c"), 18, 2, Color("2e6684")))
	upgrade_overlay.add_child(panel)
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 38)
	margin.add_theme_constant_override("margin_top", 30)
	margin.add_theme_constant_override("margin_right", 38)
	margin.add_theme_constant_override("margin_bottom", 30)
	panel.add_child(margin)
	var content := VBoxContainer.new()
	content.add_theme_constant_override("separation", 14)
	margin.add_child(content)
	var eyebrow := Label.new()
	eyebrow.text = "系统升级可用"
	eyebrow.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	eyebrow.add_theme_font_size_override("font_size", 14)
	eyebrow.add_theme_color_override("font_color", Color("65dfff"))
	content.add_child(eyebrow)
	upgrade_title = Label.new()
	upgrade_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	upgrade_title.add_theme_font_size_override("font_size", 29)
	upgrade_title.add_theme_color_override("font_color", Color("ffffff"))
	content.add_child(upgrade_title)
	var separator := HSeparator.new()
	separator.add_theme_constant_override("separation", 8)
	content.add_child(separator)
	upgrade_list = VBoxContainer.new()
	upgrade_list.add_theme_constant_override("separation", 10)
	content.add_child(upgrade_list)


func build_game_over_overlay(root: Control) -> void:
	game_over_overlay = ColorRect.new()
	game_over_overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	game_over_overlay.color = Color(0.04, 0.015, 0.04, 0.84)
	game_over_overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	root.add_child(game_over_overlay)
	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.position = Vector2(-250.0, -195.0)
	panel.size = Vector2(500.0, 390.0)
	panel.add_theme_stylebox_override("panel", make_box(Color("201326"), 20, 2, Color("a74770")))
	game_over_overlay.add_child(panel)
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 45)
	margin.add_theme_constant_override("margin_top", 40)
	margin.add_theme_constant_override("margin_right", 45)
	margin.add_theme_constant_override("margin_bottom", 40)
	panel.add_child(margin)
	var content := VBoxContainer.new()
	content.add_theme_constant_override("separation", 22)
	margin.add_child(content)
	var title := Label.new()
	title.text = "信号中断"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 38)
	title.add_theme_color_override("font_color", Color("ff6d8e"))
	content.add_child(title)
	result_label = Label.new()
	result_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	result_label.add_theme_font_size_override("font_size", 20)
	result_label.add_theme_color_override("font_color", Color("f0dae4"))
	result_label.custom_minimum_size = Vector2(0.0, 115.0)
	content.add_child(result_label)
	var restart := Button.new()
	restart.text = "重新出发  [Enter]"
	restart.custom_minimum_size = Vector2(0.0, 60.0)
	restart.add_theme_font_size_override("font_size", 20)
	restart.add_theme_stylebox_override("normal", make_box(Color("7f3152"), 12))
	restart.add_theme_stylebox_override("hover", make_box(Color("b3456f"), 12, 2, Color("ff8bab")))
	restart.pressed.connect(new_game)
	content.add_child(restart)


func make_box(color: Color, radius: int, border_width: int = 0, border_color: Color = Color.TRANSPARENT) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = color
	box.corner_radius_top_left = radius
	box.corner_radius_top_right = radius
	box.corner_radius_bottom_left = radius
	box.corner_radius_bottom_right = radius
	if border_width > 0:
		box.border_width_left = border_width
		box.border_width_top = border_width
		box.border_width_right = border_width
		box.border_width_bottom = border_width
		box.border_color = border_color
	return box
