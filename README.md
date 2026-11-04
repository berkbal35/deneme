# İzmir building bundle (Overture Maps)

- `izmir_buildings.parquet` (34 MB): Overture Maps release 2026-09-23.1, theme=buildings, rows inside
  lng 26.90–27.35 / lat 38.28–38.56 (İzmir metro). 382,885 buildings: 341,643 from OpenStreetMap,
  41,242 from Microsoft ML Buildings (not in OSM). Only 390 carry a height and 1,584 a floor count.
  Columns: id, geometry (WKB), bbox, height, num_floors, roof_shape, subtype, class, src.
  Fetched with `tools/overture/fetch_izmir.py` (pyarrow over HTTPS range reads; needs a venv with
  pyarrow, fsspec, aiohttp, shapely; DuckDB's httpfs extension cannot be downloaded from the container).
- `izmir.ymb` (6.9 MB): the same buildings as a compact bundle for the apps, made by
  `tools/overture/export_ymb.py`, verified by `tools/overture/decode_ymb.mjs`.

## YMB1 format
Raw deflate (zlib wbits = -15) of, little-endian:
`"YMB1"`, u8 version (1), u32 tile count, then per z14 tile: u16 x, u16 y, u32 building count, then per
building: u16 height in dm (0 = unknown), u8 floors (0 = unknown), u8 flags (bit0 = Microsoft source,
bits1-2 roof: 1 flat, 2 gabled, 3 hipped), u8 ring count, then per ring: u16 point count and the points
as zigzag-LEB128 varint deltas of (lng, lat) in 1e-7 degrees. Each building's first point is relative to
the tile's north-west corner; later points are relative to the previous point (across rings). Rings are
open (no repeated closing point), outer ring first. A building belongs to the tile of its representative
point; a renderer building tile T must also take the buildings of T's 8 neighbours whose bounds reach
into T's buffer.

## Heights: GlobalBuildingAtlas (added 2026-10-18)
`izmir.ymb` now carries heights for 362,209 of 382,893 buildings (94.6%); Overture's own height wins where
it has one (390), the rest come from `izmir_heights.parquet` (id, height_m, gba_source; 362,555 rows):
- 333,614 from the GBA.LoD1 polygon with the largest footprint overlap (overlaps under 20% of either
  footprint are ignored as slivers), 18 from the GBA polygon containing the representative point,
- 28,923 from the GBA.Height raster (3 m, UTM 35N): median of the 3x3 pixels at the representative point,
  kept when >= 2 m. 20,330 buildings stay without a height (apps estimate as before).
- Heights: 5th/50th/95th percentile 2.2 / 6.4 / 14.0 m, max 74.4 m. Caution: against the 328 buildings
  where OSM has a height, GBA is about half (median ratio 0.54, ~1.9 m per OSM floor), so GBA likely
  underestimates mid-rise blocks; a renderer may want a scale factor or a floor-based minimum.

Source: GlobalBuildingAtlas (Zhu et al., ESSD 17, 6647, 2025, https://github.com/zhu-xlab/GlobalBuildingAtlas),
licence **CC BY-NC 4.0** (non-commercial; credit required). Tile africa/e025_n40_e030_n35 only:
- HuggingFace zhu-xlab/GBA.ODbLPolygon (2.18 GB GeoJSON) + GBA.LoD1 Polygon (2.2 MB) and LoD1 JSON
  (407 MB, key source+id+region -> height), streamed and clipped to the bbox (+0.01°) into
  `gba/izmir_gba_lod1.parquet` (223,935 polygons, WKB EPSG:4326, all Microsoft-derived "ms").
  The full tiles were not kept. Script: `tools/overture/gba_extract.py`.
- mediaTUM GBA.Height (dataserv.ub.tum.de WebDAV, login m1782307/m1782307): 6 GeoTIFFs pulled out of
  the 14 GB zip by range reads (`tools/overture/gba_zipget.py`) into `gba/height_tif/` (1.25 GB).
- Join: `tools/overture/gba_join.py izmir_buildings.parquet gba/izmir_gba_lod1.parquet izmir_heights.parquet gba/height_tif/*.tif`,
  then `export_ymb.py izmir_buildings.parquet izmir.ymb izmir_heights.parquet` (now 7.3 MB).
  Needs a venv with pyarrow, shapely, numpy, ijson, rasterio, pyproj. Hosts needed: huggingface.co,
  us.aws.cdn.hf.co, dataserv.ub.tum.de.
