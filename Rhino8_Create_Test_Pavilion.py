# Rhino 8 Python script: construct a 12m x 9m pavilion for GLB / WebXR export.
# RUN ONLY IN A NEW, EMPTY RHINO DOCUMENT. Rhino model Z is UP.
# In Rhino 8, type: _RunPythonScript and select this file.
import rhinoscriptsyntax as rs
import System.Drawing.Color as Color

# Metres in Rhino's unit enumeration = 4.
rs.UnitSystem(4, True)

def layer(name, rgb):
    if not rs.IsLayer(name):
        rs.AddLayer(name, rgb)
    return name

slab = layer('01_FLOOR', Color.FromArgb(190, 200, 213))
wall = layer('02_WALL', Color.FromArgb(220, 227, 237))
steel = layer('03_STRUCTURE', Color.FromArgb(92, 128, 150))
furniture = layer('04_FURNITURE', Color.FromArgb(179, 141, 105))

def add_box(name, origin, size, ly):
    x,y,z=origin
    a,b,c=size
    p=[(x,y,z),(x+a,y,z),(x+a,y+b,z),(x,y+b,z),
       (x,y,z+c),(x+a,y,z+c),(x+a,y+b,z+c),(x,y+b,z+c)]
    result=rs.AddBox(p)
    rs.ObjectName(result,name)
    rs.ObjectLayer(result,ly)
    return result

# Front faces negative Y (towards approach); Rhino Z is vertical.
add_box('floor_12x9',(-6,-4.5,0),(12,9,.18),slab)
add_box('roof',(-6,-4.5,3.4),(12,9,.22),slab)
add_box('back_wall',(-6,4.36,.18),(12,.14,2.9),wall)
for x in [-6,5.82]:
    add_box('side_low_wall',(x,-4.5,.18),(.18,9,1.0),wall)
    for y in [-4.42,0,4.26]:
        add_box('steel_pier',(x,y,.18),(.18,.18,3.25),steel)
for x in [-6,1.5]:
    add_box('front_pier',(x,-4.5,.18),(4.5,.18,2.7),wall)
add_box('front_header',(-1.5,-4.5,2.9),(3,.18,.25),steel)
add_box('desk',(1,-2,0.18),(2.7,1.2,.7),furniture)
add_box('kitchen',(-4,-1.8,.18),(2.7,1.1,.85),furniture)
add_box('threshold',(-1.5,-5.2,0),(3,.7,.14),slab)
rs.ZoomExtents()
print('Pavilion created: 12 x 9 m, height 3.62 m.')
print('NEXT: Select All -> Export Selected -> GL Transmission Format (.glb)')
print('Enable Map Rhino Z to glTF Y + Export materials, then upload GLB in WebXR page.')
