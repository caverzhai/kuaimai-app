import { useMemo } from 'react';
import pcaData from '../data/pca.json';

interface RegionSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

type PcaDataType = Record<string, Record<string, string[]>>;

export function RegionSelector({ value, onChange }: RegionSelectorProps) {
  const data = pcaData as PcaDataType;

  // 解析当前值
  const parts = value ? value.split('/') : [];
  const selectedProvince = parts[0] || '';
  const selectedCity = parts[1] || '';
  const selectedDistrict = parts[2] || '';

  const provinces = useMemo(() => Object.keys(data), [data]);

  const cities = useMemo(() => {
    if (!selectedProvince || !data[selectedProvince]) return [];
    return Object.keys(data[selectedProvince]);
  }, [selectedProvince, data]);

  const districts = useMemo(() => {
    if (!selectedProvince || !selectedCity || !data[selectedProvince]?.[selectedCity]) return [];
    return data[selectedProvince][selectedCity];
  }, [selectedProvince, selectedCity, data]);

  const handleProvinceChange = (province: string) => {
    onChange(province ? `${province}/` : '');
  };

  const handleCityChange = (city: string) => {
    onChange(`${selectedProvince}/${city}/`);
  };

  const handleDistrictChange = (district: string) => {
    onChange(`${selectedProvince}/${selectedCity}/${district}`);
  };

  return (
    <div className="space-y-2">
      <select
        value={selectedProvince}
        onChange={(e) => handleProvinceChange(e.target.value)}
        className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
      >
        <option value="">请选择省份</option>
        {provinces.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      {selectedProvince && (
        <select
          value={selectedCity}
          onChange={(e) => handleCityChange(e.target.value)}
          className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
        >
          <option value="">请选择城市</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      )}

      {selectedCity && districts.length > 0 && (
        <select
          value={selectedDistrict}
          onChange={(e) => handleDistrictChange(e.target.value)}
          className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
        >
          <option value="">请选择区县</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
