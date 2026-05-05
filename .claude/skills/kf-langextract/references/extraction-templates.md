# Domain Extraction Templates

Template examples for common extraction domains. Adapt schema + examples per use case.

## Clinical / Medical Notes

```python
examples = [
    lx.data.ExampleData(
        text="Patient reports taking Metformin 500mg twice daily with meals. Also uses Lisinopril 10mg once daily for hypertension.",
        extractions=[
            lx.data.Extraction(extraction_class="medication", extraction_text="Metformin 500mg twice daily",
                attributes={"drug": "Metformin", "dosage": "500mg", "frequency": "twice daily", "route": "oral"}),
            lx.data.Extraction(extraction_class="medication", extraction_text="Lisinopril 10mg once daily",
                attributes={"drug": "Lisinopril", "dosage": "10mg", "frequency": "once daily", "route": "oral"}),
            lx.data.Extraction(extraction_class="diagnosis", extraction_text="hypertension",
                attributes={"condition": "hypertension"}),
        ]
    ),
    lx.data.ExampleData(
        text="DX: Type 2 diabetes mellitus. Rx: Januvia 100mg qd.",
        extractions=[
            lx.data.Extraction(extraction_class="diagnosis", extraction_text="Type 2 diabetes mellitus",
                attributes={"condition": "Type 2 diabetes mellitus"}),
            lx.data.Extraction(extraction_class="medication", extraction_text="Januvia 100mg qd",
                attributes={"drug": "Januvia", "dosage": "100mg", "frequency": "qd"}),
        ]
    ),
]
```

## Financial Reports / Transactions

```python
examples = [
    lx.data.ExampleData(
        text="Q3 2025 Revenue: $12.4M (up 18% YoY). Operating expenses: $8.1M. Net income: $2.3M.",
        extractions=[
            lx.data.Extraction(extraction_class="financial_metric", extraction_text="$12.4M",
                attributes={"metric": "Revenue", "period": "Q3 2025", "value": "12.4M", "currency": "USD", "change": "+18% YoY"}),
            lx.data.Extraction(extraction_class="financial_metric", extraction_text="$8.1M",
                attributes={"metric": "Operating expenses", "period": "Q3 2025", "value": "8.1M", "currency": "USD"}),
            lx.data.Extraction(extraction_class="financial_metric", extraction_text="$2.3M",
                attributes={"metric": "Net income", "period": "Q3 2025", "value": "2.3M", "currency": "USD"}),
        ]
    ),
]
```

## Log Parsing

```python
examples = [
    lx.data.ExampleData(
        text="2025-11-15 14:32:01 ERROR [auth] Failed login attempt for user 'admin' from IP 192.168.1.50",
        extractions=[
            lx.data.Extraction(extraction_class="log_entry", extraction_text="2025-11-15 14:32:01 ERROR [auth] Failed login attempt for user 'admin' from IP 192.168.1.50",
                attributes={"timestamp": "2025-11-15 14:32:01", "level": "ERROR", "module": "auth",
                           "message": "Failed login attempt", "user": "admin", "ip": "192.168.1.50"}),
        ]
    ),
]
```

## Legal / Contract Clauses

```python
examples = [
    lx.data.ExampleData(
        text="The Agreement shall commence on January 1, 2025 and continue for a period of 24 months.",
        extractions=[
            lx.data.Extraction(extraction_class="contract_term", extraction_text="January 1, 2025",
                attributes={"type": "start_date", "value": "2025-01-01"}),
            lx.data.Extraction(extraction_class="contract_term", extraction_text="24 months",
                attributes={"type": "duration", "value": "24", "unit": "months"}),
        ]
    ),
]
```

## Entity/Relationship Extraction

```python
examples = [
    lx.data.ExampleData(
        text="Alice Johnson is the CTO of Acme Corp. She reports to CEO Bob Smith.",
        extractions=[
            lx.data.Extraction(extraction_class="person", extraction_text="Alice Johnson",
                attributes={"role": "CTO", "organization": "Acme Corp"}),
            lx.data.Extraction(extraction_class="person", extraction_text="Bob Smith",
                attributes={"role": "CEO", "organization": "Acme Corp"}),
            lx.data.Extraction(extraction_class="organization", extraction_text="Acme Corp",
                attributes={"type": "company"}),
            lx.data.Extraction(extraction_class="relationship", extraction_text="reports to",
                attributes={"subject": "Alice Johnson", "object": "Bob Smith", "type": "reporting_line"}),
        ]
    ),
]
```
