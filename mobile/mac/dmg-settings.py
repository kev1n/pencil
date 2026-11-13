# How Pencil.dmg's window looks when opened, read by dmgbuild (see build.sh):
# the app on the left, a shortcut to Applications on the right, over
# dmg-background.tiff. The positions match the arrow drawn in that picture.
app = defines["app"]  # noqa: F821 (dmgbuild provides `defines`)

format = "UDZO"
files = [app]
symlinks = {"Applications": "/Applications"}
icon = "mac/AppIcon.icns"
background = "mac/dmg-background.tiff"
window_rect = ((200, 200), (620, 400))
default_view = "icon-view"
show_status_bar = False
show_tab_view = False
show_toolbar = False
show_pathbar = False
show_sidebar = False
icon_size = 120
text_size = 13
icon_locations = {"Pencil.app": (165, 200), "Applications": (455, 200)}
