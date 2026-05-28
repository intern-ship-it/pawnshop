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

    public function __construct(array $rows, int $headerRowCount = 4)
    {
        $this->rows = $rows;
        $this->headerRowCount = $headerRowCount; // The row where the column titles are
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

        return [];
    }
}
