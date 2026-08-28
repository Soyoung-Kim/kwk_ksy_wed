-- Optional: Run after wedding_gallery_variants.sql.
-- Registers the current GitHub-hosted local images in the admin gallery.
-- They remain static files, but can be ordered or hidden with is_visible.

insert into public.wedding_gallery
  (image_url, thumbnail_url, source_type, alt, display_order, is_visible)
select source.image_url, source.image_url, 'asset', source.alt, source.display_order, true
from (
  values
    ('./assets/photos/28.jpg', '웨딩 사진 1', 10),
    ('./assets/photos/1.jpg', '웨딩 사진 2', 20),
    ('./assets/photos/2.jpg', '웨딩 사진 3', 30),
    ('./assets/photos/3.jpg', '웨딩 사진 4', 40),
    ('./assets/photos/4.jpg', '웨딩 사진 5', 50),
    ('./assets/photos/5.jpg', '웨딩 사진 6', 60),
    ('./assets/photos/6.jpg', '웨딩 사진 7', 70),
    ('./assets/photos/7.jpg', '웨딩 사진 8', 80),
    ('./assets/photos/8.jpg', '웨딩 사진 9', 90),
    ('./assets/photos/9.jpg', '웨딩 사진 10', 100),
    ('./assets/photos/10.jpg', '웨딩 사진 11', 110),
    ('./assets/photos/11.jpg', '웨딩 사진 12', 120),
    ('./assets/photos/12.jpg', '웨딩 사진 13', 130),
    ('./assets/photos/13.jpg', '웨딩 사진 14', 140),
    ('./assets/photos/14.jpg', '웨딩 사진 15', 150),
    ('./assets/photos/15.jpg', '웨딩 사진 16', 160),
    ('./assets/photos/16.jpg', '웨딩 사진 17', 170),
    ('./assets/photos/17.jpg', '웨딩 사진 18', 180),
    ('./assets/photos/18.jpg', '웨딩 사진 19', 190),
    ('./assets/photos/19.jpg', '웨딩 사진 20', 200),
    ('./assets/photos/20.jpg', '웨딩 사진 21', 210),
    ('./assets/photos/22.jpg', '웨딩 사진 22', 220),
    ('./assets/photos/23.jpg', '웨딩 사진 23', 230),
    ('./assets/photos/24.jpg', '웨딩 사진 24', 240),
    ('./assets/photos/25.jpg', '웨딩 사진 25', 250),
    ('./assets/photos/26.jpg', '웨딩 사진 26', 260)
) as source(image_url, alt, display_order)
where not exists (
  select 1 from public.wedding_gallery current where current.image_url = source.image_url
);
