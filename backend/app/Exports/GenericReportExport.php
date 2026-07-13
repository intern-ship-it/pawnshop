<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class GenericReportExport implements FromArray, WithStyles, ShouldAutoSize
{
    protected $rows;
    protected $headerRowCount;
    protected $bannerSpec;

    protected $numberFormat;

    /**
     * $bannerSpec accepts, in order of increasing structure:
     *   a single banner  ['row'=>..,'startCol'=>..,'endCol'=>..]
     *   a list of banners [ [...], [...] ]
     *   a full spec      ['banners'=>[...], 'numberFormat'=>['cols'=>[..],'format'=>'0.00']]
     */
    public function __construct(array $rows, int $headerRowCount = 4, ?array $bannerSpec = null)
    {
        $this->rows = $rows;
        $this->headerRowCount = $headerRowCount; // The row where the column titles are
        $this->bannerSpec = $this->normalizeBanners($bannerSpec);
        $this->numberFormat = $bannerSpec['numberFormat'] ?? null;
    }

    private function normalizeBanners(?array $spec): array
    {
        if (!$spec) {
            return [];
        }
        if (isset($spec['banners'])) {
            return array_values($spec['banners']);
        }

        return isset($spec['row']) ? [$spec] : array_values($spec);
    }

    public function array(): array
    {
        return $this->rows;
    }

    public function styles(Worksheet $sheet)
    {
        // General style for the top metadata rows (Report Type, Date Range, etc.)
        if ($this->headerRowCount > 1) {
            $sheet->getStyle('A1:Z2')->applyFromArray([
                'font' => [
                    'bold' => true,
                ],
            ]);
        }

        // The column header row (e.g. Pledge Date, Pledge No, etc.)
        $headerRow = $this->headerRowCount;
        $highestColumn = $sheet->getHighestColumn();

        $sheet->getStyle("A{$headerRow}:{$highestColumn}{$headerRow}")->applyFromArray([
            'font' => [
                'bold' => true,
                'color' => ['rgb' => 'FFFFFF'],
            ],
            'fill' => [
                'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                'color' => ['rgb' => '4A5568'], // A nice dark gray background
            ],
            'alignment' => [
                'horizontal' => \PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER,
                'vertical' => \PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_CENTER,
            ],
        ]);

        // Merged banners above groups of columns (e.g. "Payment Mode" over Transfer/Cash)
        foreach ($this->bannerSpec as $banner) {
            $row = $banner['row'];
            $start = $banner['startCol'];
            $end = $banner['endCol'];

            if ($start !== $end) {
                $sheet->mergeCells("{$start}{$row}:{$end}{$row}");
            }
            $sheet->getStyle("{$start}{$row}:{$end}{$row}")->applyFromArray([
                'font' => [
                    'bold' => true,
                    'color' => ['rgb' => 'FFFFFF'],
                ],
                'fill' => [
                    'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                    'color' => ['rgb' => '4A5568'],
                ],
                'alignment' => [
                    'horizontal' => \PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER,
                    'vertical' => \PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_CENTER,
                ],
            ]);
        }

        // Numeric columns keep their true value; Excel renders the fixed decimals.
        if ($this->numberFormat) {
            $firstDataRow = $this->headerRowCount + 1;
            $lastRow = max($firstDataRow, $sheet->getHighestRow());

            foreach ($this->numberFormat['cols'] as $col) {
                $sheet->getStyle("{$col}{$firstDataRow}:{$col}{$lastRow}")
                    ->getNumberFormat()
                    ->setFormatCode($this->numberFormat['format']);
            }
        }

        return [];
    }
}
