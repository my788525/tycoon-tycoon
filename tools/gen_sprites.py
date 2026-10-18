#!/usr/bin/env python3
# 发展国 · 像素贴图集生成器（CC0 风格本地素材，100% 离线）
# 输出到 assets/：角色多帧、办公室背景 4 档、道具
from PIL import Image, ImageDraw
import os, math

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")
os.makedirs(OUT, exist_ok=True)

# ---------- 调色板 ----------
SKIN=(242,216,176,255); SKIN_D=(210,180,140,255)
HAIR=(61,44,30,255); EYE=(42,42,42,255)
PANTS=(61,74,92,255); PANTS_D=(45,55,70,255)
SHOE=(42,42,42,255)
SHIRTS=[(245,185,66,255),(127,176,214,255),(107,158,90,255),(201,123,45,255),(217,93,93,255)]
WOOD=(139,111,78,255); WOOD_D=(92,74,50,255)
METAL=(44,62,80,255); SCREEN=(159,216,245,255)
LEAF=(107,158,90,255); POT=(201,123,45,255)

def new_img(logic_w, logic_h, scale):
    return Image.new("RGBA", (logic_w*scale, logic_h*scale), (0,0,0,0))

def put_px(img, x, y, color, scale, rw=1, rh=1):
    """在逻辑坐标 (x,y) 画 rw×rh 色块"""
    d = ImageDraw.Draw(img)
    d.rectangle([x*scale, y*scale, (x+rw)*scale-1, (y+rh)*scale-1], fill=color)

def make_char_shirt(shirt, standing=True, frame=0):
    """16×24 角色像素（放大后 16*PX）"""
    S = 6
    img = new_img(16, 24, S)
    cx = 4  # 左侧偏移（角色 8px 宽居中）
    # 头
    put_px(img, cx+1, 1, HAIR, S, 6, 2)
    put_px(img, cx+1, 3, SKIN, S, 6, 6)
    put_px(img, cx+2, 4, EYE, S, 1, 1); put_px(img, cx+5, 4, EYE, S, 1, 1)
    put_px(img, cx+1, 3, (255,255,255,110), S, 1, 1)
    # 身体（衬衫）
    put_px(img, cx, 9, shirt, S, 8, 9)
    put_px(img, cx+3, 9, SKIN, S, 2, 1)  # 领口
    put_px(img, cx, 14, (0,0,0,40), S, 8, 1)  # 腰带
    # 手臂
    put_px(img, cx-1, 11, shirt, S, 1, 5); put_px(img, cx+8, 11, shirt, S, 1, 5)
    put_px(img, cx-1, 16, SKIN, S, 1, 1); put_px(img, cx+8, 16, SKIN, S, 1, 1)
    # 腿（4 帧走路）
    if standing:
        put_px(img, cx+1, 18, PANTS, S, 2, 5); put_px(img, cx+5, 18, PANTS, S, 2, 5)
        put_px(img, cx+1, 23, SHOE, S, 2, 1); put_px(img, cx+5, 23, SHOE, S, 2, 1)
    else:
        lift = [1,0,1,0][frame]
        put_px(img, cx+1, 18+lift, PANTS, S, 2, 5-lift); put_px(img, cx+5, 18-lift, PANTS, S, 2, 5-lift)
        put_px(img, cx+1, 23+lift, SHOE, S, 2, 1); put_px(img, cx+5, 23-lift, SHOE, S, 2, 1)
    return img

def make_office_bg(tier):
    """160×96 办公室背景（放大后 160*PX × 96*PX）"""
    S = 4
    W, H = 160, 96
    img = Image.new("RGBA", (W*S, H*S), (0,0,0,0))
    d = ImageDraw.Draw(img)
    # 配色
    palettes = [
        dict(sky=(232,241,245,255), wall=(216,200,176,255), floor=(201,184,154,255), floor2=(190,170,130,255)),
        dict(sky=(234,244,248,255), wall=(220,232,224,255), floor=(200,216,200,255), floor2=(180,200,180,255)),
        dict(sky=(220,232,245,255), wall=(200,216,232,255), floor=(184,200,216,255), floor2=(164,184,200,255)),
        dict(sky=(240,224,192,255), wall=(232,208,160,255), floor=(216,192,128,255), floor2=(200,175,110,255)),
    ]
    p = palettes[min(tier,4)-1]
    # 墙面
    d.rectangle([0,0,W*S,H*S], fill=p['wall'])
    # 顶部光照渐变（用条带）
    for i in range(20):
        a = int(30*(1-i/20))
        d.rectangle([0, i*S, W*S, i*S+S-1], fill=(255,244,200,a))
    # 踢脚线
    d.rectangle([0, (H-20)*S, W*S, (H-18)*S], fill=(60,44,30,60))
    # 地板砖
    fy = (H-32)*S
    d.rectangle([0, fy, W*S, H*S], fill=p['floor'])
    for x in range(0, W*S, 26*S):
        d.line([x, fy, x, H*S], fill=(60,40,20,50), width=1)
    for y in range(fy, H*S, 18*S):
        d.line([0, y, W*S, y], fill=(60,40,20,50), width=1)
    # 地板高光
    for x in range(4*S, W*S, 52*S):
        d.rectangle([x, fy+2*S, x+20*S, fy+4*S], fill=(255,255,255,40))
    # 窗户（tier>=2）
    if tier>=2:
        n = tier-1
        for i in range(n):
            wx = 40*S + i*(W*S-80*S)//max(1,n-1) if n>1 else 40*S
            wy, ww, wh = 34*S, 44*S, 34*S
            # 玻璃
            for gy in range(wh):
                t = gy/wh
                c = (int(191+(127-191)*t), int(227+(176-227)*t), int(245+(214-245)*t), 255)
                d.line([wx, wy+gy, wx+ww, wy+gy], fill=c)
            # 云
            d.ellipse([wx+8*S, wy+8*S, wx+20*S, wy+20*S], fill=(255,255,255,200))
            d.ellipse([wx+14*S, wy+7*S, wx+26*S, wy+19*S], fill=(255,255,255,220))
            d.ellipse([wx+22*S, wy+9*S, wx+34*S, wy+21*S], fill=(255,255,255,200))
            # 窗框
            d.rectangle([wx, wy, wx+ww, wy+wh], outline=(61,44,30,255), width=2)
            d.line([wx+ww//2, wy, wx+ww//2, wy+wh], fill=(61,44,30,255), width=1)
            d.line([wx, wy+wh//2, wx+ww, wy+wh//2], fill=(61,44,30,255), width=1)
    # 吊灯（tier>=3）
    if tier>=3:
        n = tier-1
        for i in range(n):
            lx = 60*S + i*(W*S-120*S)//max(1,n-1) if n>1 else 60*S
            ly = 20*S
            d.line([lx, 0, lx, ly], fill=(61,44,30,255), width=2)
            d.ellipse([lx-6*S, ly-6*S, lx+6*S, ly+6*S], fill=(245,185,66,255), outline=(61,44,30,255), width=2)
            for r in range(20, 2, -2):
                a = int(40*r/20)
                d.ellipse([lx-r*S//2, ly-r*S//2, lx+r*S//2, ly+r*S//2], outline=(255,240,180,a))
    # 画框/海报（tier>=2）
    if tier>=2:
        for i in range(tier):
            fx = (W-90)*S + i*26*S; fy2 = 16*S
            d.rectangle([fx, fy2, fx+20*S, fy2+26*S], fill=(255,253,247,255), outline=(61,44,30,255), width=2)
            inner = [SHIRTS[i%5]]
            d.rectangle([fx+4*S, fy2+4*S, fx+16*S, fy2+18*S], fill=inner[0])
            d.rectangle([fx+4*S, fy2+4*S, fx+16*S, fy2+8*S], fill=(255,255,255,160))
    return img

def make_desk():
    """桌面 + 显示器（32×32 逻辑）"""
    S = 5
    W,H = 32, 32
    img = Image.new("RGBA", (W*S, H*S), (0,0,0,0))
    d = ImageDraw.Draw(img)
    cx = 16*S
    # 桌腿
    d.rectangle([cx-11*S, 20*S, cx-8*S, 30*S], fill=WOOD_D)
    d.rectangle([cx+8*S, 20*S, cx+11*S, 30*S], fill=WOOD_D)
    # 桌面
    d.rectangle([cx-13*S, 18*S, cx+13*S, 22*S], fill=WOOD, outline=(0,0,0,80), width=1)
    d.rectangle([cx-13*S, 18*S, cx+13*S, 20*S], fill=(220,190,150,255))
    # 显示器
    d.rectangle([cx-9*S, 6*S, cx+9*S, 18*S], fill=METAL, outline=(30,40,55,255), width=2)
    d.rectangle([cx-8*S, 7*S, cx+8*S, 17*S], fill=SCREEN)
    d.rectangle([cx-8*S, 7*S, cx-2*S, 11*S], fill=(255,255,255,160))
    d.rectangle([cx-2*S, 18*S, cx+2*S, 20*S], fill=METAL)  # 支架
    # 键盘
    d.rectangle([cx-7*S, 22*S, cx+7*S, 24*S], fill=(74,74,74,255))
    for k in range(3):
        d.rectangle([cx-6*S+k*4*S, 22*S, cx-4*S+k*4*S, 23*S], fill=(120,120,120,255))
    return img

def make_plant():
    """盆栽（16×16 逻辑）"""
    S = 6
    img = Image.new("RGBA", (16*S,16*S), (0,0,0,0))
    d = ImageDraw.Draw(img)
    cx = 8*S
    # 盆
    d.polygon([(cx-4*S,12*S),(cx+4*S,12*S),(cx+2*S,16*S),(cx-2*S,16*S)], fill=POT, outline=(120,70,30,255))
    # 叶
    for (ox,oy,r) in [(-3,8,3),(0,6,4),(3,8,3),(0,10,3),(-2,11,2)]:
        d.ellipse([cx+ox*S-r*S, oy*S-r*S, cx+ox*S+r*S, oy*S+r*S], fill=LEAF, outline=(70,110,60,255))
    return img

# ---------- UI 图标（Kairosoft 手账风，供 4 个 HTML 卡片标题用） ----------
def make_icon(kind, size=128):
    """手绘风 128×128 图标：coin/rep/fan/office/team/rocket/trophy"""
    img = Image.new("RGBA", (size,size), (0,0,0,0))
    d = ImageDraw.Draw(img)
    c = size//2
    if kind=='coin':
        d.ellipse([c-50,c-50,c+50,c+50], fill=(245,185,66,255), outline=(120,70,30,255), width=6)
        d.ellipse([c-36,c-36,c+36,c+36], outline=(120,70,30,255), width=3)
        d.text((c-18,c-26),'¥',font=None,fill=(120,70,30,255))
    elif kind=='rep':
        d.rectangle([c-44,c-44,c+44,c+44], fill=(127,176,214,255), outline=(44,62,80,255), width=6)
        d.line([c-30,c+30,c+30,c-30], fill=(44,62,80,255), width=14)
    elif kind=='fan':
        # 人群
        for ox in (-34,0,34):
            d.ellipse([c+ox-12,c-18,c+ox+12,c+6], fill=SKIN, outline=(120,70,30,255))
            d.rounded_rectangle([c+ox-20,c+4,c+ox+20,c+44], radius=12, fill=SHIRTS[0], outline=(120,70,30,255))
    elif kind=='office':
        d.rectangle([c-40,c-44,c+40,c+44], fill=(200,184,154,255), outline=(61,44,30,255), width=6)
        for wx in (-28,-14,0,14,28):
            for wy in (-30,-14,2,18):
                d.rectangle([c+wx-8,c+wy-8,c+wx+8,c+wy+8], fill=(159,216,245,255), outline=(61,44,30,255))
    elif kind=='team':
        d.rounded_rectangle([c-44,c-20,c+44,c+44], radius=10, fill=SHIRTS[1], outline=(44,62,80,255), width=5)
        d.ellipse([c-16,c-44,c+16,c-8], fill=SKIN, outline=(61,44,30,255))
        d.ellipse([c-4,c-40,c+8,c-30], fill=HAIR)
    elif kind=='rocket':
        d.polygon([(c,c-44),(c+22,c+10),(c+14,c+44),(c-14,c+44),(c-22,c+10)], fill=(217,93,93,255), outline=(61,44,30,255), width=4)
        d.ellipse([c-12,c-24,c+12,c-4], fill=(159,216,245,255), outline=(61,44,30,255))
        d.polygon([(c-10,c+30),(c+10,c+30),(c,c+48)], fill=(245,185,66,255))
    elif kind=='trophy':
        d.rectangle([c-20,c-44,c+20,c+4], fill=(245,185,66,255), outline=(120,70,30,255), width=4)
        d.polygon([(c-20,c-36),(c+20,c-36),(c+20,c+4),(c-20,c+4)], outline=(120,70,30,255))
        d.rectangle([c-30,c+10,c+30,c+22], fill=(245,185,66,255), outline=(120,70,30,255), width=3)
        d.ellipse([c-16,c+22,c+16,c+40], fill=(245,185,66,255), outline=(120,70,30,255), width=3)
    return img

def main():
    # 角色 5 色 × 4 帧
    for ci, shirt in enumerate(SHIRTS):
        make_char_shirt(shirt, standing=True, frame=0).save(os.path.join(OUT, f"char_stand_{ci}.png"))
        for f in range(4):
            make_char_shirt(shirt, standing=False, frame=f).save(os.path.join(OUT, f"char_walk_{ci}_{f}.png"))
    # 背景 4 档
    for t in range(1,5):
        make_office_bg(t).save(os.path.join(OUT, f"office_{t}.png"))
    # 道具
    make_desk().save(os.path.join(OUT, "desk.png"))
    make_plant().save(os.path.join(OUT, "plant.png"))
    # UI 图标（Kairosoft 手账风，供 4 个 HTML 卡片标题 / HUD 用）
    for kind in ["coin","rep","fan","office","team","rocket","trophy"]:
        make_icon(kind, 128).save(os.path.join(OUT, f"icon_{kind}.png"))
    print("✓ sprites generated to", OUT)
    for f in sorted(os.listdir(OUT)):
        if f.endswith(".png"):
            im = Image.open(os.path.join(OUT,f))
            print(f"  {f}  {im.size[0]}x{im.size[1]}  {os.path.getsize(os.path.join(OUT,f))//1024}KB")

if __name__=="__main__":
    main()
