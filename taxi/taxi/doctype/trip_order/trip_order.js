// Copyright (c) 2017, Bilal Ghayad and contributors
// For license information, please see license.txt

cur_frm.add_fetch('assigned_driver', 'employee_name', 'driver_name')
cur_frm.add_fetch('assigned_driver', 'money_collection_account', 'driver_cash_account')
cur_frm.add_fetch('origination_place','metric','origin_metric')
cur_frm.add_fetch('to', 'metric', 'to_metric')
cur_frm.add_fetch('customer', 'classification', 'customer_classification_and_description')


frappe.ui.form.on('Trip Order', {

	setup: function(frm) {
		frm.add_fetch("company", "default_receivable_account", "receivable_account");
		frm.add_fetch("company", "default_income_account", "income_account");
		frm.add_fetch("company", "cost_center", "cost_center");
        },

	refresh: function(frm) {
		if(frm.doc.docstatus===1) {
			frm.add_custom_button(__('Accounting Ledger'), function() {
				frappe.route_options = {
					voucher_no: frm.doc.name,
					from_date: frm.doc.transaction_date,
					to_date: frm.doc.transaction_date,
					company: frm.doc.company,
					group_by_voucher: false
				};
				frappe.set_route("query-report", "General Ledger");
			}, __("View"));

			frm.add_custom_button(__("Show Payments"), function() {
				frappe.set_route("List", "Payment Entry", {"Payment Entry Reference.reference_name": frm.doc.name});
			}, __("View"));
		}
	},


        onload: function(frm) {

		frm.set_query("to", "hops", function(doc, cdt, cdn) {
			var d = locals[cdt][cdn];
			return {
				query: "taxi.taxi.doctype.trip_order.trip_order.get_origination"
			}
		});

                frm.set_query("assigned_driver", function(doc) {
                        return {
                                filters: {
                                        'status': 'Active'
                                }
                        };
                });

                frm.set_query("origination_place", function(doc) {
                        return {
                                filters: {
                                        'item_group': 'Taxi Hop'
                                }
                        };
                });

		frm.set_query("receivable_account", function(doc) {
			return {
				filters: {
					'account_type': 'Receivable',
					'is_group': 0,
					'company': frm.doc.company
				}
			};
		});
		frm.set_query("income_account", function(doc) {
			return {
				filters: {
					'account_type': 'Income Account',
					'is_group': 0,
					'company': frm.doc.company
				}
			};
		});

                frm.set_query("driver_cash_account", function(doc) {
                        return {
                                filters: {
                                        'account_type': 'Cash',
                                        'is_group': 0,
                                        'company': doc.company
                                }
                        };
                });

		frm.set_query("cost_center", function(doc) {
			return {
				filters: {
					'is_group': 0,
					'company': doc.company
				}
			};
		});

	},

	customer: function(frm) {
		//msgprint ("Welcome");
		frappe.call({
			method: "erpnext.accounts.utils.get_balance_on",
			args: {date: frm.doc.transaction_date, party_type: 'Customer', party: frm.doc.customer},
			callback: function(r) {
				//msgprint(r.message);
				cur_frm.set_value("customer_balance", r.message);
				//frm.doc.customer_balance = 1000
				//frm.doc.customer_balance = format_currency(r.message, erpnext.get_currency(frm.doc.company));
				refresh_field('customer_balance');
			}
		});
	},

	assigned_driver: function(frm) {
		if (cur_frm.doc.assigned_driver) {
			frappe.call({
				method: "taxi.taxi.doctype.trip_order.trip_order.get_vehicle",
				args: {
					AssignedDriver: frm.doc.assigned_driver
				},
				callback: function(r) {
					if (r.message) {
						cur_frm.set_value("vehicle", r.message);
					}
				}
			})
			cur_frm.set_value("order_status", "Assigned");
		}
	},

	discounted_percentage: function(frm) {

		if (frm.doc.discounted_amount_event == 1)
			frm.set_value('discounted_amount_event', 0);
		else {
			frm.set_value('discounted_percentage_event', 1);
			frm.set_value('discounted_amount', frm.doc.total_price * frm.doc.discounted_percentage/100);
			frm.set_value('grand_total', frm.doc.total_price - frm.doc.discounted_amount);
			if (flt(frm.doc.cash_amount) > flt(frm.doc.grand_total))
				frm.set_value('cash_amount', frm.doc.grand_total);
			frm.set_value('credit_amount', frm.doc.grand_total - frm.doc.cash_amount);
			frm.set_value('outstanding_amount', frm.doc.credit_amount);
		}
	},

	discounted_amount: function(frm) {
	
		if (frm.doc.discounted_percentage_event == 1)
			frm.set_value('discounted_percentage_event', 0);
		else {
			frm.set_value('discounted_amount_event', 1);
			frm.set_value('grand_total', frm.doc.total_price - frm.doc.discounted_amount);
			frm.set_value('discounted_percentage', frm.doc.discounted_amount * 100 / frm.doc.total_price);
			if (flt(frm.doc.cash_amount) > flt(frm.doc.grand_total))
				frm.set_value('cash_amount', frm.doc.grand_total);
			frm.set_value('credit_amount', frm.doc.grand_total - frm.doc.cash_amount);
			frm.set_value('outstanding_amount', frm.doc.credit_amount);
		}
	},

	cash_amount: function(frm) {

	if (frm.doc.cash_amount > frm.doc.grand_total) {
		frm.set_value('cash_amount', flt(0));
		frappe.msgprint(__("Cash Amount can not be more than Grand Amount"));
	}
	else
		frm.set_value('credit_amount', frm.doc.grand_total - frm.doc.cash_amount);
		frm.set_value('outstanding_amount', frm.doc.credit_amount);

	},

	money_collection: function(frm) {

		if (flt(frm.doc.credit_amount) > 0 && flt(frm.doc.money_collection) > 0) {
			frm.set_value('money_collection', flt(0));
			frappe.msgprint(__("Can not set value for money collection if credit amount > 0"));
		}
	}
});

frappe.ui.form.on('Trip Order Hops', {

	items_remove: function(frm, cdt, cdn) {

		hops_calculation(frm, cdt, cdn);
	},

	to_metric: function(frm, cdt, cdn) {

		hops_calculation(frm, cdt, cdn);
	},

	ozw: function(frm, cdt, cdn) {

		var item_selected = locals[cdt][cdn];
		if (item_selected.ozw == 1) {
			if (item_selected.idx == 1) {
				item_selected.ozw_metric = item_selected.to_metric;
				item_selected.to_metric = frm.doc.origin_metric;
			}
			else {
				item_selected.ozw_metric = item_selected.to_metric;
				item_selected.to_metric = frm.doc.hops[(item_selected.idx) - 2].to_metric;
			}
		}
		else
			item_selected.to_metric = item_selected.ozw_metric;
		//frappe.msgprint(__("Changes happened at {0}", [frm.doc.hops[(item_selected.idx) - 2].to]));
		$.each(frm.doc.hops, function(i, row) {
			if (row.ozw == 1) {
				if (flt (i) == 0)
					row.to_metric = frm.doc.origin_metric;
				else
					row.to_metric = frm.doc.hops[i-1].to_metric;
			}
		})
		hops_calculation(frm, cdt, cdn);

	}
});

var hops_calculation = function(frm, cdt, cdn) {
	var item = locals[cdt][cdn];
	var rows_quantity = 0;
	frm.set_value('total_price', 0);
	frm.set_value('discounted_amount', 0.00);
	frm.set_value('discounted_percentage', 0.00);
	frm.set_value('cash_amount', 0.00);
	frappe.call({
		method: "taxi.taxi.doctype.trip_order.trip_order.get_settings",
		callback: function(r) {
			if (r.message) {
				$.each(frm.doc.hops, function(i, row) {
		  	        	if (row.to_metric) {
						if (i < (r.message[0] - 1)) {
							if (flt(row.to_metric) > flt(frm.doc.origin_metric)) {
								row.selected_metric = row.to_metric;
							}
							else {
								row.selected_metric = frm.doc.origin_metric;
							}
						}
						else if (i >= (r.message[1]-1)) {
							if (flt(row.to_metric) >= flt(frm.doc.hops[i-1].to_metric))
								row.selected_metric = row.to_metric;
							else
								row.selected_metric = frm.doc.hops[i-1].to_metric;
						}
						else {
							if (flt(row.to_metric) > flt(frm.doc.hops[i-1].to_metric))
								row.selected_metric = row.to_metric;
							else if (flt(row.to_metric) < flt(frm.doc.hops[i-1].to_metric))
								row.selected_metric = frm.doc.hops[i-1].to_metric;
							else
								row.selected_metric = r.message[2];
						}
						if (row.ozw == 1)
							row.hop_price = 0;
						else
							row.hop_price = flt(row.selected_metric);
						frm.set_value('total_price', frm.doc.total_price + row.hop_price);
						refresh_field("hops");
						rows_quantity = rows_quantity + 1;
					}
				})
				if ((rows_quantity-1) >= 0) {
					frm.set_value('final_destination', frm.doc.hops[rows_quantity-1].to);
				}
				else
					frm.set_value('final_destination', "Not Selected");
				
				frm.set_value('grand_total', frm.doc.total_price);
				frm.set_value('credit_amount', frm.doc.grand_total);
				frm.set_value('outstanding_amount', frm.doc.credit_amount);
			}
		}
	})
	refresh_field("hops");
}
